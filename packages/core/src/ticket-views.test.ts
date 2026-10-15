import { expect, test } from "bun:test";
import type { Ticket } from "@kibo/schema";
import { createProjectDoc, executeProjectCommand, readProject } from "./index";

const newDoc = () =>
  createProjectDoc({
    id: "p1",
    key: "EMIS",
    name: "Emis",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
  });

const create = (d: ReturnType<typeof newDoc>, title: string, parentId?: string) =>
  executeProjectCommand(d, { method: "createTicket", title, parentId }) as Ticket;

const view = (d: ReturnType<typeof newDoc>, id: string) => {
  const t = readProject(d).tickets.find((x) => x.id === id);
  if (!t) throw new Error(`missing ${id}`);
  return t;
};

test("a group shows the status derived from its sub-tickets, never startable", () => {
  const d = newDoc();
  const group = create(d, "C4");
  const a = create(d, "A", group.id);
  create(d, "B", group.id);
  executeProjectCommand(d, { method: "setStatus", ticketId: group.id, statusId: "blocked", reason: "x" });
  expect(view(d, group.id)).toMatchObject({
    statusId: "todo",
    blockedReason: null,
    startable: false,
    progress: { done: 0, total: 2 },
  });
  executeProjectCommand(d, { method: "setStatus", ticketId: a.id, statusId: "done" });
  expect(view(d, group.id)).toMatchObject({ statusId: "in_progress", progress: { done: 1, total: 2 } });
});

test("the stored status of a group is kept, and comes back once it loses its sub-tickets", () => {
  const d = newDoc();
  const group = create(d, "C4");
  executeProjectCommand(d, { method: "setStatus", ticketId: group.id, statusId: "in_review" });
  const a = create(d, "A", group.id);
  executeProjectCommand(d, { method: "setStatus", ticketId: a.id, statusId: "done" });
  expect(view(d, group.id).statusId).toBe("done");
  executeProjectCommand(d, { method: "deleteTicket", ticketId: a.id });
  expect(view(d, group.id)).toMatchObject({ statusId: "in_review", progress: { done: 0, total: 0 } });
});

test("a nested group counts as done only when all its sub-tickets are", () => {
  const d = newDoc();
  const group = create(d, "C4");
  const nested = create(d, "C4.3", group.id);
  const leaf = create(d, "C4.3.1", nested.id);
  executeProjectCommand(d, { method: "setStatus", ticketId: nested.id, statusId: "done" });
  expect(view(d, group.id).progress).toEqual({ done: 0, total: 1 });
  executeProjectCommand(d, { method: "setStatus", ticketId: leaf.id, statusId: "done" });
  expect(view(d, group.id)).toMatchObject({ statusId: "done", progress: { done: 1, total: 1 } });
});

test("a ticket blocked by a group waits until the group is done", () => {
  const d = newDoc();
  const group = create(d, "C4");
  const a = create(d, "A", group.id);
  const next = create(d, "Suite");
  executeProjectCommand(d, { method: "setStatus", ticketId: group.id, statusId: "done" });
  executeProjectCommand(d, { method: "addLink", from: group.id, to: next.id, type: "blocks" });
  expect(view(d, next.id)).toMatchObject({ waitingOn: ["EMIS-1"], startable: false });
  executeProjectCommand(d, { method: "setStatus", ticketId: a.id, statusId: "done" });
  expect(view(d, next.id)).toMatchObject({ waitingOn: [], startable: true });
});
