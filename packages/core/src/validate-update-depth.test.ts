import { describe, expect, test } from "bun:test";
import { LoroDoc, LoroList, LoroMap, LoroTree, type LoroTreeNode } from "loro-crdt";
import {
  addPage,
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  MAX_CONTAINER_DEPTH,
  MAX_TREE_DEPTH,
  type UpdateVerdict,
  validateProjectUpdate,
  writeMembers,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" };

function sharedServer(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "A" });
  doc.getMap("meta").delete("folder");
  doc.commit();
  enableServerAllocation(doc);
  writeMembers(doc, [{ userId: "u-adam", name: "Adam" }]);
  return doc;
}

function verdictFor(server: LoroDoc, edit: (client: LoroDoc) => void): UpdateVerdict {
  const client = new LoroDoc();
  client.import(server.export({ mode: "update" }));
  edit(client);
  client.commit();
  const after = server.fork();
  after.import(client.export({ mode: "update", from: server.oplogVersion() }));
  return validateProjectUpdate(server, after);
}

function chain(tree: LoroTree, length: number): LoroTreeNode[] {
  const nodes = [tree.createNode()];
  for (let i = 1; i < length; i++) nodes.push((nodes[i - 1] as LoroTreeNode).createNode());
  return nodes;
}

function nest(root: LoroMap, depth: number): LoroMap {
  let current = root;
  for (let i = 0; i < depth; i++) current = current.setContainer("x", new LoroMap());
  return current;
}

const ticketField = (doc: LoroDoc): LoroMap => {
  const [first] = doc.getTree("tickets").roots();
  if (!first) throw new Error("fixture has no ticket");
  return first.data.setContainer("extra", new LoroMap());
};

const treeRefused = { ok: false, reason: expect.stringContaining(`${MAX_TREE_DEPTH}`) };
const nestingRefused = { ok: false, reason: expect.stringContaining(`${MAX_CONTAINER_DEPTH}`) };

function expectSoundProcess(): void {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "Sain" });
  const copy = new LoroDoc();
  copy.import(doc.export({ mode: "snapshot" }));
  expect(copy.getTree("tickets").toJSON()).toHaveLength(1);
}

describe("tree depth", () => {
  test("limits are named", () => {
    expect(MAX_TREE_DEPTH).toBe(64);
    expect(MAX_CONTAINER_DEPTH).toBe(32);
  });

  test("a ticket chain at the limit is accepted", () => {
    const verdict = verdictFor(sharedServer(), (c) => chain(c.getTree("tickets"), MAX_TREE_DEPTH));
    expect(verdict).toEqual({ ok: true });
  });

  test("a ticket chain one level deeper is refused", () => {
    const verdict = verdictFor(sharedServer(), (c) => chain(c.getTree("tickets"), MAX_TREE_DEPTH + 1));
    expect(verdict).toEqual(treeRefused);
  });

  test("a chain of 1500 tickets is refused without harming the process", () => {
    const verdict = verdictFor(sharedServer(), (c) => chain(c.getTree("tickets"), 1500));
    expect(verdict).toEqual(treeRefused);
    expectSoundProcess();
  });

  test("ten levels of subtickets are accepted", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      let parentId: string | null = null;
      for (let i = 0; i < 10; i++) parentId = createTicket(c, { title: `Niveau ${i}`, parentId }).id;
    });
    expect(verdict).toEqual({ ok: true });
  });

  test("a move that makes the tree too deep is refused", () => {
    const server = sharedServer();
    const upper = chain(server.getTree("tickets"), 40);
    const lower = chain(server.getTree("tickets"), 40);
    server.commit();
    const leaf = upper.at(-1)?.id;
    const root = lower[0]?.id;
    if (!leaf || !root) throw new Error("fixture has chains");
    const verdict = verdictFor(server, (c) => c.getTree("tickets").move(root, leaf));
    expect(verdict).toEqual(treeRefused);
  });

  test("a deleted chain still counts", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const [top] = chain(c.getTree("tickets"), MAX_TREE_DEPTH + 1);
      if (top) c.getTree("tickets").delete(top.id);
    });
    expect(verdict).toEqual(treeRefused);
  });

  test("the pages tree is bounded too", () => {
    const verdict = verdictFor(sharedServer(), (c) => chain(c.getTree("pages"), MAX_TREE_DEPTH + 1));
    expect(verdict).toEqual(treeRefused);
  });

  test("a legitimate page hierarchy is accepted", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const root = addPage(c, { title: "Racine", kind: "view" });
      addPage(c, { title: "Enfant", kind: "view", parentId: root.id });
    });
    expect(verdict).toEqual({ ok: true });
  });

  test("a tree nested in a ticket field is bounded too", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      chain(ticketField(c).setContainer("tree", new LoroTree()), MAX_TREE_DEPTH + 1);
    });
    expect(verdict).toEqual(treeRefused);
  });
});

describe("container depth", () => {
  test("maps nested on five levels are accepted", () => {
    const verdict = verdictFor(sharedServer(), (c) => nest(ticketField(c), 5).set("leaf", 1));
    expect(verdict).toEqual({ ok: true });
  });

  test("a ticket field nested up to the limit is accepted", () => {
    const verdict = verdictFor(sharedServer(), (c) => nest(ticketField(c), MAX_CONTAINER_DEPTH - 3));
    expect(verdict).toEqual({ ok: true });
  });

  test("an empty container one level too deep is refused", () => {
    const verdict = verdictFor(sharedServer(), (c) => nest(ticketField(c), MAX_CONTAINER_DEPTH - 2));
    expect(verdict).toEqual(nestingRefused);
  });

  test("a filled container one level too deep is refused", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      nest(ticketField(c), MAX_CONTAINER_DEPTH - 2).set("leaf", 1);
    });
    expect(verdict).toEqual(nestingRefused);
  });

  test("nested lists are bounded too", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      let list = ticketField(c).setContainer("list", new LoroList());
      for (let i = 0; i < 40; i++) list = list.insertContainer(0, new LoroList());
    });
    expect(verdict).toEqual(nestingRefused);
  });

  test("a batch deepening an existing nesting is refused", () => {
    const server = sharedServer();
    const deepest = nest(ticketField(server), MAX_CONTAINER_DEPTH - 3);
    deepest.set("leaf", 1);
    server.commit();
    const verdict = verdictFor(server, (c) => {
      const mirror = c.getContainerById(deepest.id);
      if (!(mirror instanceof LoroMap)) throw new Error("fixture has a nesting");
      mirror.setContainer("x", new LoroMap()).set("leaf", 2);
    });
    expect(verdict).toEqual(nestingRefused);
  });

  test("5000 nested maps are refused without harming the process", () => {
    const verdict = verdictFor(sharedServer(), (c) => nest(ticketField(c), 5000));
    expect(verdict).toEqual(nestingRefused);
    expectSoundProcess();
  });
});
