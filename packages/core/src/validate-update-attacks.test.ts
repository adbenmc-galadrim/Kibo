import { describe, expect, test } from "bun:test";
import { LoroCounter, LoroDoc, LoroMap, LoroText } from "loro-crdt";
import {
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  listTickets,
  type UpdateAuthor,
  type UpdateVerdict,
  validateProjectUpdate,
  writeMembers,
} from "./index";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316", worktree: null };
const OWNER: UpdateAuthor = { userId: "u-adam", role: "owner" };

function sharedServer(): LoroDoc {
  const doc = createProjectDoc(meta);
  createTicket(doc, { title: "A" });
  createTicket(doc, { title: "B" });
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
  return validateProjectUpdate(server, after, OWNER);
}

const firstNode = (doc: LoroDoc) => {
  const [first] = doc.getTree("tickets").roots();
  if (!first) throw new Error("fixture has no ticket");
  return first;
};

const refused = { ok: false, reason: expect.any(String) };

describe("reserved fields replaced by a container of equal content", () => {
  test("ticketSeq as a LoroCounter", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").setContainer("ticketSeq", new LoroCounter()).increment(2);
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("ticketSeq") });
  });

  test("keyAllocator as a LoroText", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").setContainer("keyAllocator", new LoroText()).insert(0, "server");
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("keyAllocator") });
  });

  test("meta.key as a LoroText", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").setContainer("key", new LoroText()).insert(0, "KIB");
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("meta.key") });
  });

  test("a ticket key as a LoroText", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const node = firstNode(c);
      const key = node.data.get("key");
      node.data.setContainer("key", new LoroText()).insert(0, typeof key === "string" ? key : "");
    });
    expect(verdict).toEqual(refused);
  });

  test("members as a plain value of the same shape", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").set("members", { "u-adam": { name: "Adam" } });
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("members") });
  });

  test("members replaced by a new LoroMap of the same content", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").setContainer("members", new LoroMap()).set("u-adam", { name: "Adam" });
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("members") });
  });

  test("a member entry given extra fields", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const directory = c.getMap("meta").get("members");
      if (!(directory instanceof LoroMap)) throw new Error("fixture has members");
      directory.set("u-adam", { name: "Adam", role: "owner" });
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("members") });
  });

  test("a member entry turned into a container", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      const directory = c.getMap("meta").get("members");
      if (!(directory instanceof LoroMap)) throw new Error("fixture has members");
      directory.setContainer("u-adam", new LoroMap()).set("name", "Adam");
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("members") });
  });
});

describe("editable meta fields keep their type", () => {
  test("meta.name set to a number", () => {
    const verdict = verdictFor(sharedServer(), (c) => c.getMap("meta").set("name", 42));
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("meta.name") });
  });

  test("meta.color set to null", () => {
    const verdict = verdictFor(sharedServer(), (c) => c.getMap("meta").set("color", null));
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("meta.color") });
  });

  test("an unknown meta field", () => {
    const verdict = verdictFor(sharedServer(), (c) => c.getMap("meta").set("owner", "u-mallory"));
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("meta.owner") });
  });

  test("an unknown meta field already shared does not block later updates", () => {
    const server = sharedServer();
    server.getMap("meta").set("legacy", "kept");
    server.commit();
    const verdict = verdictFor(server, (c) => c.getMap("meta").set("name", "Kibo 2"));
    expect(verdict).toEqual({ ok: true });
  });

  test("an unknown meta field already shared cannot be modified", () => {
    const server = sharedServer();
    server.getMap("meta").set("legacy", "kept");
    server.commit();
    const verdict = verdictFor(server, (c) => c.getMap("meta").set("legacy", "changed"));
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("meta.legacy") });
  });

  test("a rename keeps being accepted", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      c.getMap("meta").set("name", "Kibo 2");
      c.getMap("meta").set("color", "#0EA5E9");
    });
    expect(verdict).toEqual({ ok: true });
  });
});

describe("deeply nested containers", () => {
  const nest = (root: LoroMap, depth: number) => {
    let current = root;
    for (let i = 0; i < depth; i++) current = current.setContainer("x", new LoroMap());
  };

  test("under meta.name are refused without reading them", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      nest(c.getMap("meta").setContainer("name", new LoroMap()), 5000);
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("meta.name") });
    expect(listTickets(createProjectDoc(meta))).toEqual([]);
  });

  test("under a free ticket field are refused without reading them", () => {
    const verdict = verdictFor(sharedServer(), (c) => {
      nest(firstNode(c).data.setContainer("extra", new LoroMap()), 5000);
    });
    expect(verdict).toEqual({ ok: false, reason: expect.stringContaining("nested") });
    expect(createTicket(createProjectDoc(meta), { title: "Sain" }).title).toBe("Sain");
  });
});
