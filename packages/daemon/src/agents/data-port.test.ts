import { expect, test } from "bun:test";
import { createProjectDoc, createTicket, listTickets, setStatus } from "@kibo/core";
import { applyRules } from "./data-port";

const doc = () => createProjectDoc({ id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" });

test("a finished run sends its ticket to review, and a manual status wins", () => {
  const d = doc();
  const t = createTicket(d, { title: "A", statusId: "in_progress" });
  const blocked = createTicket(d, { title: "B", statusId: "todo" });
  setStatus(d, blocked.id, "blocked", "attente");
  expect(applyRules(d, { kind: "run_done", ticketId: t.id })).toEqual([
    { method: "setStatus", ticketId: t.id, statusId: "in_review" },
  ]);
  expect(applyRules(d, { kind: "run_done", ticketId: blocked.id })).toEqual([]);
  expect(listTickets(d).map((x) => x.statusId)).toEqual(["in_review", "blocked"]);
});

test("the last child done closes its parent", () => {
  const d = doc();
  const parent = createTicket(d, { title: "P", statusId: "in_progress" });
  const a = createTicket(d, { title: "A", parentId: parent.id });
  const b = createTicket(d, { title: "B", parentId: parent.id });
  setStatus(d, a.id, "done");
  expect(applyRules(d, { kind: "status_changed", ticketId: a.id })).toEqual([]);
  setStatus(d, b.id, "done");
  applyRules(d, { kind: "status_changed", ticketId: b.id });
  expect(listTickets(d).find((x) => x.id === parent.id)?.statusId).toBe("done");
});

test("a chain of parents closes in the order the rules return", () => {
  const d = doc();
  const root = createTicket(d, { title: "R", statusId: "in_progress" });
  const mid = createTicket(d, { title: "M", parentId: root.id, statusId: "in_progress" });
  const leaf = createTicket(d, { title: "L", parentId: mid.id });
  setStatus(d, leaf.id, "done");
  expect(applyRules(d, { kind: "status_changed", ticketId: leaf.id })).toEqual([
    { method: "setStatus", ticketId: mid.id, statusId: "done" },
    { method: "setStatus", ticketId: root.id, statusId: "done" },
  ]);
  expect(listTickets(d).map((x) => x.statusId)).toEqual(["done", "done", "done"]);
});
