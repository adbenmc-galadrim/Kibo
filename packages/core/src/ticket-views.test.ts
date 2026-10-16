import { expect, test } from "bun:test";
import type { Sprint, Ticket } from "@kibo/schema";
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
    tracking: null,
  });

const create = (d: ReturnType<typeof newDoc>, title: string, parentId?: string) =>
  executeProjectCommand(d, { method: "createTicket", title, parentId }) as Ticket;

const view = (d: ReturnType<typeof newDoc>, id: string) => {
  const t = readProject(d, "2026-10-14").tickets.find((x) => x.id === id);
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

const status = (d: ReturnType<typeof newDoc>, ticketId: string, statusId: Ticket["statusId"]) =>
  executeProjectCommand(d, { method: "setStatus", ticketId, statusId });
const optional = (d: ReturnType<typeof newDoc>, ticketId: string) =>
  executeProjectCommand(d, { method: "setTicketOptional", ticketId, optional: true });
const viewOn = (d: ReturnType<typeof newDoc>, today: string, id: string) => {
  const t = readProject(d, today).tickets.find((x) => x.id === id);
  if (!t) throw new Error(`missing ${id}`);
  return t;
};

test("every ticket carries the sprint of its root, and only a root with steps is a feature", () => {
  const d = newDoc();
  const s42 = executeProjectCommand(d, {
    method: "createSprint",
    code: "S42",
    name: "S42",
    start: "2026-10-12",
    end: "2026-10-16",
  }) as Sprint;
  const f5 = create(d, "Photos");
  const step = create(d, "Envoi", f5.id);
  const sub = create(d, "Compression", step.id);
  const solo = create(d, "Seul");
  executeProjectCommand(d, { method: "setTicketSprint", ticketId: f5.id, sprintId: s42.id });
  for (const id of [f5.id, step.id, sub.id]) expect(view(d, id).effectiveSprintId).toBe(s42.id);
  expect(view(d, solo.id).effectiveSprintId).toBeNull();
  expect(view(d, f5.id).feature).toMatchObject({ status: "todo", steps: { done: 0, total: 1 } });
  expect(view(d, step.id).feature).toBeNull();
  expect(view(d, solo.id).feature).toBeNull();
});

test("a group is done once its mandatory steps are, an optional demo left to do", () => {
  const d = newDoc();
  const f3 = create(d, "Rapports");
  const a = create(d, "PDF", f3.id);
  const demo = create(d, "Démo client", f3.id);
  optional(d, demo.id);
  status(d, a.id, "done");
  expect(view(d, f3.id)).toMatchObject({ statusId: "done", progress: { done: 1, total: 2 } });
  expect(view(d, f3.id).feature).toMatchObject({ status: "delivered", remaining: 0 });
  expect(view(d, demo.id).optional).toBe(true);
  expect(() => optional(d, f3.id)).toThrow("INVALID_INPUT");
});

test("a feature is late on its sprint's last day with a step to do, dated by the given day", () => {
  const d = newDoc();
  const s42 = executeProjectCommand(d, {
    method: "createSprint",
    code: "S42",
    name: "S42",
    start: "2026-10-12",
    end: "2026-10-16",
  }) as Sprint;
  const f5 = create(d, "Photos");
  const a = create(d, "Envoi", f5.id);
  create(d, "Relance", f5.id);
  status(d, a.id, "in_progress");
  executeProjectCommand(d, { method: "setTicketSprint", ticketId: f5.id, sprintId: s42.id });
  expect(viewOn(d, "2026-10-15", f5.id).feature?.status).toBe("open");
  expect(viewOn(d, "2026-10-16", f5.id).feature).toMatchObject({ status: "late", remaining: 2 });
  status(d, a.id, "in_review");
  expect(viewOn(d, "2026-10-16", f5.id).feature?.status).toBe("late");
  expect(view(d, f5.id).feature?.status).toBe("open");
});

test("a feature whose next step has an open blocking question is blocked", () => {
  const d = newDoc();
  const f6 = create(d, "Signature");
  const a = create(d, "Écran", f6.id);
  executeProjectCommand(d, {
    method: "createQuestion",
    ticketId: a.id,
    title: "Q14",
    blocking: true,
    createdBy: { kind: "human", ref: "adam" },
  });
  expect(view(d, f6.id).feature).toMatchObject({ status: "blocked", nextStepId: a.id });
});
