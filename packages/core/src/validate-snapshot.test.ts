import { expect, test } from "bun:test";
import type { Binding } from "@kibo/schema";
import { type LoroDoc, LoroMap } from "loro-crdt";
import { addBinding, createProjectDoc, createTicket, deleteTicket, validateSharedSnapshot } from "./index";

function sharable(): LoroDoc {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
  });
  createTicket(doc, { title: "Noyau de données" });
  createTicket(doc, { title: "Schéma Loro des tickets" });
  doc.getMap("meta").delete("folder");
  doc.commit();
  return doc;
}

function edited(edit: (doc: LoroDoc) => void): LoroDoc {
  const doc = sharable();
  edit(doc);
  doc.commit();
  return doc;
}

const reasonOf = (doc: LoroDoc, projectId = "p1"): string | null => {
  const verdict = validateSharedSnapshot(doc, projectId, "u-adam");
  return verdict.ok ? null : verdict.reason;
};

test("accepts a migrated local project", () => {
  expect(validateSharedSnapshot(sharable(), "p1", "u-adam")).toEqual({ ok: true });
});

test("accepts an explicit local key allocator", () => {
  expect(reasonOf(edited((d) => d.getMap("meta").set("keyAllocator", "local")))).toBeNull();
});

test("refuses a local folder, even null", () => {
  expect(reasonOf(edited((d) => d.getMap("meta").set("folder", "/Users/adam/kibo")))).toContain(
    "meta.folder",
  );
  expect(reasonOf(edited((d) => d.getMap("meta").set("folder", null)))).toContain("meta.folder");
});

test("refuses a project already shared or carrying a member directory", () => {
  expect(reasonOf(edited((d) => d.getMap("meta").set("keyAllocator", "server")))).toContain(
    "meta.keyAllocator",
  );
  expect(reasonOf(edited((d) => d.getMap("meta").setContainer("members", new LoroMap())))).toContain(
    "meta.members",
  );
});

test("refuses unknown fields and containers in meta", () => {
  expect(reasonOf(edited((d) => d.getMap("meta").set("evil", "x")))).toContain("meta.evil");
  expect(reasonOf(edited((d) => d.getMap("meta").setContainer("name", new LoroMap())))).toContain(
    "meta.name",
  );
  expect(reasonOf(edited((d) => d.getMap("meta").setContainer("key", new LoroMap())))).toContain("meta.key");
});

test("refuses meta values that break ProjectMeta", () => {
  expect(reasonOf(edited((d) => d.getMap("meta").set("name", "  ")))).toContain("meta.name");
  expect(reasonOf(edited((d) => d.getMap("meta").set("color", "orange")))).toContain("meta.color");
  expect(reasonOf(edited((d) => d.getMap("meta").set("key", "kib")))).toContain("meta.key");
});

test("refuses an id that is not the shared project's", () => {
  expect(reasonOf(sharable(), "p2")).toContain("meta.id");
  expect(reasonOf(edited((d) => d.getMap("meta").set("id", 7)))).toContain("meta.id");
});

test("refuses a ticket sequence that is not a natural number", () => {
  for (const seq of [-1, 1.5, "2", null]) {
    expect(reasonOf(edited((d) => d.getMap("meta").set("ticketSeq", seq)))).toContain("meta.ticketSeq");
  }
});

test("refuses a key above the ticket sequence", () => {
  expect(reasonOf(edited((d) => d.getMap("meta").set("ticketSeq", 1)))).toContain("KIB-2");
});

test("refuses duplicate keys, deleted tickets included", () => {
  const doc = edited((d) => {
    const [first] = d.getTree("tickets").roots();
    first?.data.set("key", "KIB-2");
  });
  expect(reasonOf(doc)).toContain("KIB-2");
  const withDeleted = sharable();
  const [first] = withDeleted.getTree("tickets").roots();
  deleteTicket(withDeleted, first?.id.toString() ?? "");
  const [survivor] = withDeleted.getTree("tickets").roots();
  survivor?.data.set("key", "KIB-1");
  withDeleted.commit();
  expect(reasonOf(withDeleted)).toContain("KIB-1");
});

test("refuses malformed ticket keys and live tickets without key", () => {
  expect(
    reasonOf(
      edited((d) => {
        const [first] = d.getTree("tickets").roots();
        first?.data.set("key", "OTHER-1");
      }),
    ),
  ).toContain("OTHER-1");
  expect(
    reasonOf(
      edited((d) => {
        const [first] = d.getTree("tickets").roots();
        first?.data.setContainer("key", new LoroMap());
      }),
    ),
  ).toContain("key");
  expect(
    reasonOf(
      edited((d) => {
        const [first] = d.getTree("tickets").roots();
        first?.data.delete("key");
      }),
    ),
  ).toContain("no key");
});

test("refuses a document nested deeper than the sync bound", () => {
  const deep = edited((doc) => {
    let node = doc.getTree("pages").createNode();
    for (let i = 0; i < 100; i++) node = node.createNode();
  });
  expect(reasonOf(deep)).toContain("deeper than 64");
});

test("bindings of the first snapshot are valid and run by the owner", () => {
  const binding: Binding = {
    id: "b1",
    adapter: "github-issues",
    config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
    createdBy: "u-adam",
    runner: "u-adam",
  };
  expect(reasonOf(edited((d) => addBinding(d, binding)))).toBeNull();
  expect(reasonOf(edited((d) => addBinding(d, { ...binding, runner: "u-lea" })))).toContain("b1");
  expect(reasonOf(edited((d) => addBinding(d, { ...binding, createdBy: "u-lea" })))).toContain("b1");
  expect(reasonOf(edited((d) => d.getMap("bindings").set("b1", { id: "b1" })))).toContain("b1");
  expect(reasonOf(edited((d) => d.getMap("bindings").setContainer("b1", new LoroMap())))).toContain("b1");
  expect(reasonOf(edited((d) => d.getMap("bindings").set("b2", binding)))).toContain("b2");
});
