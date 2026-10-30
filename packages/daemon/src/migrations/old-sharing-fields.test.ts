import { expect, test } from "bun:test";
import { createProjectDoc, createTicket, readProject } from "@kibo/core";
import { Ticket } from "@kibo/schema";
import { LoroMap } from "loro-crdt";

const meta = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
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

test("a doc written by an old shared project is read and written as a local one, its sharing fields ignored", () => {
  const doc = createProjectDoc(meta);
  const old = createTicket(doc, { title: "Ancien" });
  const project = doc.getMap("meta");
  project.set("keyAllocator", "server");
  project.set("shared", true);
  project.set("roles", { "u-lea": "editor" });
  project.setContainer("members", new LoroMap()).set("u-lea", { name: "Léa" });
  const pending = doc.getTree("tickets").createNode().data;
  pending.set("key", null);
  pending.set("pendingSeq", 3);
  pending.set("title", "En attente");
  pending.set("statusId", "todo");
  pending.set("blockedReason", null);
  doc.commit();
  expect(() => readProject(doc, "2026-10-30")).not.toThrow();
  const snapshot = readProject(doc, "2026-10-30");
  expect(snapshot.nextTicketKey).toBe("KIB-2");
  expect(snapshot.tickets.find((t) => t.id === old.id)?.key).toBe("KIB-1");
  expect(Object.keys(snapshot)).not.toContain("sync");
  expect(createTicket(doc, { title: "Nouveau" }).key).toBe("KIB-2");
});

test("a ticket stored with a pending sequence parses without it", () => {
  const ticket = Ticket.parse({
    id: "1@1",
    key: null,
    pendingSeq: 3,
    title: "En attente",
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
  });
  expect(ticket).not.toHaveProperty("pendingSeq");
});
