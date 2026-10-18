import { describe, expect, test } from "bun:test";
import { featureLabel, KiboError, type ProjectMeta } from "@kibo/schema";
import { LoroDoc } from "loro-crdt";
import {
  allocateTicketKeys,
  createProjectDoc,
  createTicket,
  enableServerAllocation,
  executeProjectCommand,
  getTicket,
  moveTicket,
  updateTicket,
  validateProjectUpdate,
  validateSharedSnapshot,
} from "./index";

const META: ProjectMeta = {
  id: "p1",
  key: "EMIS",
  name: "Emis",
  folder: null,
  color: "#F97316",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
};

const seqOf = (doc: LoroDoc): unknown => doc.getMap("meta").get("ticketSeq");

function code(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof KiboError) return error.code;
    throw error;
  }
  return "OK";
}

describe("feature keys", () => {
  test("a feature created as such takes F<n> and leaves the ticket counter alone", () => {
    const doc = createProjectDoc(META);
    const f1 = createTicket(doc, { title: "Socle", feature: true });
    const f2 = createTicket(doc, { title: "Affaires", feature: true });
    expect([f1.key, f1.shortKey, f2.key, f2.shortKey]).toEqual(["F1", "F1", "F2", "F2"]);
    expect(seqOf(doc)).toBe(0);
  });

  test("steps are numbered without a gap", () => {
    const doc = createProjectDoc(META);
    const f1 = createTicket(doc, { title: "Socle", feature: true });
    const a = createTicket(doc, { title: "Étape A", parentId: f1.id });
    const f2 = createTicket(doc, { title: "Affaires", feature: true });
    const b = createTicket(doc, { title: "Étape B", parentId: f2.id });
    expect([a.key, b.key]).toEqual(["EMIS-1", "EMIS-2"]);
    expect(getTicket(doc, f1.id).shortKey).toBe("F1");
  });

  test("a feature is a root", () => {
    const doc = createProjectDoc(META);
    const root = createTicket(doc, { title: "Racine" });
    expect(code(() => createTicket(doc, { title: "F", feature: true, parentId: root.id }))).toBe(
      "INVALID_INPUT",
    );
    const feature = createTicket(doc, { title: "Socle", feature: true });
    expect(code(() => moveTicket(doc, feature.id, root.id))).toBe("INVALID_INPUT");
    expect(getTicket(doc, feature.id).parentId).toBeNull();
  });

  test("an older root keeps its key and gains F<n> with its first child", () => {
    const doc = createProjectDoc(META);
    createTicket(doc, { title: "Socle", feature: true });
    createTicket(doc, { title: "Affaires", feature: true });
    const legacy = createTicket(doc, { title: "Ancienne racine" });
    createTicket(doc, { title: "Étape", parentId: legacy.id });
    const after = getTicket(doc, legacy.id);
    expect([after.key, after.shortKey]).toEqual(["EMIS-1", "F3"]);
    expect(featureLabel(after)).toBe("F3");
    expect(featureLabel(getTicket(doc, createTicket(doc, { title: "Planning", feature: true }).id))).toBe(
      "F4",
    );
  });

  test("the short key of a feature created as such cannot drift from its key", () => {
    const doc = createProjectDoc(META);
    const feature = createTicket(doc, { title: "Socle", feature: true });
    expect(updateTicket(doc, feature.id, { shortKey: "F1" }).shortKey).toBe("F1");
    expect(code(() => updateTicket(doc, feature.id, { shortKey: "F9" }))).toBe("INVALID_INPUT");
    expect(code(() => updateTicket(doc, feature.id, { shortKey: null }))).toBe("INVALID_INPUT");
  });

  test("the createTicket command forwards the feature flag", () => {
    const doc = createProjectDoc(META);
    const created = executeProjectCommand(doc, { method: "createTicket", title: "Socle", feature: true });
    expect(created).toMatchObject({ key: "F1", shortKey: "F1" });
  });
});

describe("feature keys in a shared project", () => {
  function shared(): LoroDoc {
    const doc = createProjectDoc(META);
    createTicket(doc, { title: "Existant" });
    enableServerAllocation(doc);
    return doc;
  }

  const peer = (doc: LoroDoc, id: number): LoroDoc => {
    const copy = LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));
    copy.setPeerId(id);
    return copy;
  };
  const editor = { userId: "u1", role: "editor" } as const;

  test("a feature waits for its key like a step, the server gives F<n> and EMIS-n", () => {
    const doc = peer(shared(), 5);
    const feature = createTicket(doc, { title: "Socle", feature: true });
    const step = createTicket(doc, { title: "Étape", parentId: feature.id });
    const moved = createTicket(doc, { title: "Déplacée" });
    moveTicket(doc, moved.id, feature.id);
    expect([feature.key, getTicket(doc, feature.id).shortKey, step.key]).toEqual([null, null, null]);
    expect(allocateTicketKeys(doc)).toEqual([
      { ticketId: feature.id, key: "F1" },
      { ticketId: step.id, key: "EMIS-2" },
      { ticketId: moved.id, key: "EMIS-3" },
    ]);
    expect(getTicket(doc, feature.id)).toMatchObject({ key: "F1", shortKey: "F1" });
    expect(seqOf(doc)).toBe(3);
  });

  test("two peers offline both creating the third feature get F3 and F4", () => {
    const server = shared();
    createTicket(server, { title: "Socle", feature: true });
    createTicket(server, { title: "Affaires", feature: true });
    allocateTicketKeys(server);
    const a = peer(server, 21);
    const b = peer(server, 22);
    const fa = createTicket(a, { title: "Planning", feature: true });
    const fb = createTicket(b, { title: "Questions", feature: true });
    expect(validateProjectUpdate(server, a, editor)).toEqual({ ok: true });
    server.import(a.export({ mode: "update" }));
    server.import(b.export({ mode: "update" }));
    allocateTicketKeys(server);
    const keys = [getTicket(server, fa.id).key, getTicket(server, fb.id).key].sort();
    expect(keys).toEqual(["F3", "F4"]);
  });

  test("a client never writes a key, a feature one included", () => {
    const before = shared();
    const after = peer(before, 7);
    const forged = after.getTree("tickets").createNode();
    forged.data.set("key", "F8");
    forged.data.set("shortKey", "F8");
    after.commit();
    expect(validateProjectUpdate(before, after, editor).ok).toBe(false);
  });

  test("a snapshot with features is valid", () => {
    const doc = createProjectDoc(META);
    const feature = createTicket(doc, { title: "Socle", feature: true });
    createTicket(doc, { title: "Étape", parentId: feature.id });
    doc.getMap("meta").delete("folder");
    doc.commit();
    expect(validateSharedSnapshot(doc, "p1", "u1")).toEqual({ ok: true });
    const verdict = (edit: (d: LoroDoc) => void) => {
      const copy = LoroDoc.fromSnapshot(doc.export({ mode: "snapshot" }));
      edit(copy);
      copy.commit();
      return validateSharedSnapshot(copy, "p1", "u1").ok;
    };
    expect(verdict((d) => d.getTree("tickets").createNode().data.set("key", "F7"))).toBe(false);
    expect(
      verdict((d) => {
        const node = d.getTree("tickets").createNode();
        node.data.set("key", "F1000");
        node.data.set("shortKey", "F1000");
      }),
    ).toBe(false);
    expect(
      verdict((d) => {
        const root = d.getTree("tickets").roots()[0];
        const child = root?.createNode();
        child?.data.set("key", "F9");
        child?.data.set("shortKey", "F9");
      }),
    ).toBe(false);
  });
});
