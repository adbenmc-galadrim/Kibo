import { expect, test } from "bun:test";
import type { Question, Sprint, Ticket, TrackingSettings } from "@kibo/schema";
import { createProjectDoc, executeProjectCommand, readProject } from "./index";

const TODAY = "2026-10-16";
const ADAM = { kind: "human", ref: "adam" } as const;

const newDoc = (tracking: TrackingSettings | null = null) =>
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
    tracking,
    description: null,
    client: null,
  });
type Doc = ReturnType<typeof newDoc>;

const create = (d: Doc, title: string, parentId?: string) =>
  executeProjectCommand(d, { method: "createTicket", title, parentId }) as Ticket;
const sprint = (d: Doc, code: string, start: string, end: string) =>
  executeProjectCommand(d, { method: "createSprint", code, name: code, start, end }) as Sprint;
const plan = (d: Doc, ticketId: string, s: Sprint) =>
  executeProjectCommand(d, { method: "setTicketSprint", ticketId, sprintId: s.id });
const status = (d: Doc, ticketId: string, statusId: Ticket["statusId"]) =>
  executeProjectCommand(d, { method: "setStatus", ticketId, statusId });
const view = (d: Doc, id: string) => {
  const t = readProject(d, TODAY).tickets.find((x) => x.id === id);
  if (!t) throw new Error(`missing ${id}`);
  return t;
};
const reasonOf = (d: Doc, id: string) => {
  const t = view(d, id);
  return { startable: t.startable, startReason: t.startReason };
};

const feature = (d: Doc, title: string, s: Sprint | null) => {
  const root = create(d, title);
  const first = create(d, `${title} 1`, root.id);
  const second = create(d, `${title} 2`, root.id);
  const last = create(d, `${title} 3`, root.id);
  if (s !== null) plan(d, root.id, s);
  return { root, first, second, last };
};

test("a step of a feature of the current or a past sprint is startable, with no reason", () => {
  const d = newDoc();
  const f = feature(d, "Photos", sprint(d, "S42", "2026-10-12", "2026-10-16"));
  const past = feature(d, "Rapports", sprint(d, "S41", "2026-10-05", "2026-10-09"));
  expect(reasonOf(d, f.first.id)).toEqual({ startable: true, startReason: null });
  expect(reasonOf(d, past.first.id)).toEqual({ startable: true, startReason: null });
});

test("in a project without any sprint, steps are startable, within the limit of features in progress", () => {
  const d = newDoc({ openLimit: 1 });
  const open = feature(d, "Photos", null);
  const next = feature(d, "Rapports", null);
  expect(reasonOf(d, open.first.id)).toEqual({ startable: true, startReason: null });
  status(d, open.first.id, "in_progress");
  expect(reasonOf(d, open.second.id)).toEqual({ startable: true, startReason: null });
  expect(reasonOf(d, next.first.id).startReason).toEqual({ kind: "limit", limit: 1 });
});

test("a step of a feature of a future sprint waits for it, one without sprint is unplanned", () => {
  const d = newDoc();
  const later = feature(d, "Signature", sprint(d, "S43", "2026-10-19", "2026-10-23"));
  const loose = feature(d, "Export", null);
  const sub = create(d, "Sous-étape", later.first.id);
  expect(reasonOf(d, later.first.id)).toEqual({ startable: false, startReason: { kind: "status" } });
  expect(reasonOf(d, sub.id)).toEqual({ startable: false, startReason: { kind: "sprint", code: "S43" } });
  expect(reasonOf(d, later.second.id).startReason).toEqual({ kind: "sprint", code: "S43" });
  expect(reasonOf(d, loose.first.id).startReason).toEqual({ kind: "unplanned" });
});

test("once the limit of features in progress is reached, only those stay startable", () => {
  const d = newDoc({ openLimit: 1 });
  const s42 = sprint(d, "S42", "2026-10-12", "2026-10-16");
  const open = feature(d, "Photos", s42);
  const next = feature(d, "Rapports", s42);
  expect(reasonOf(d, next.first.id).startable).toBe(true);
  status(d, open.first.id, "in_progress");
  expect(reasonOf(d, open.second.id)).toEqual({ startable: true, startReason: null });
  expect(reasonOf(d, next.first.id)).toEqual({
    startable: false,
    startReason: { kind: "limit", limit: 1 },
  });
  status(d, open.first.id, "done");
  status(d, open.second.id, "done");
  status(d, open.last.id, "done");
  expect(reasonOf(d, next.first.id).startable).toBe(true);
});

test("the limit defaults to two features in progress, and spares tickets outside any feature", () => {
  const d = newDoc();
  const s42 = sprint(d, "S42", "2026-10-12", "2026-10-16");
  for (const title of ["A", "B"]) status(d, feature(d, title, s42).first.id, "in_progress");
  const third = feature(d, "C", s42);
  const solo = create(d, "Seul");
  expect(reasonOf(d, third.first.id).startReason).toEqual({ kind: "limit", limit: 2 });
  expect(reasonOf(d, solo.id)).toEqual({ startable: true, startReason: null });
});

test("a dependency comes before the sprint, and names the ticket it waits for", () => {
  const d = newDoc();
  const f = feature(d, "Signature", sprint(d, "S43", "2026-10-19", "2026-10-23"));
  executeProjectCommand(d, { method: "addLink", from: f.first.id, to: f.second.id, type: "blocks" });
  expect(reasonOf(d, f.second.id).startReason).toEqual({ kind: "dependency", keys: ["EMIS-2"] });
});

test("an open blocking question is named, and no longer blocks once answered then archived", () => {
  const d = newDoc();
  const solo = create(d, "Seul");
  const q = executeProjectCommand(d, {
    method: "createQuestion",
    ticketId: solo.id,
    title: "Couleur ?",
    blocking: true,
    createdBy: ADAM,
  }) as Question;
  expect(reasonOf(d, solo.id).startReason).toEqual({ kind: "question", label: `Q${q.number}` });
  executeProjectCommand(d, {
    method: "answerQuestion",
    questionId: q.id,
    by: ADAM,
    answer: { kind: "text", text: "Orange" },
  });
  executeProjectCommand(d, { method: "archiveQuestion", questionId: q.id, by: ADAM });
  expect(reasonOf(d, solo.id)).toEqual({ startable: true, startReason: null });
});

test("a group is never startable, without a reason to show", () => {
  const d = newDoc();
  const f = feature(d, "Photos", sprint(d, "S42", "2026-10-12", "2026-10-16"));
  expect(reasonOf(d, f.root.id)).toEqual({ startable: false, startReason: { kind: "status" } });
});

const ask = (d: Doc, ticketId: string) =>
  executeProjectCommand(d, {
    method: "createQuestion",
    ticketId,
    title: "Quel format ?",
    blocking: true,
    createdBy: ADAM,
  }) as Question;

test("the last step waits for the other mandatory steps, an optional one does not hold it", () => {
  const d = newDoc();
  const f = feature(d, "Photos", sprint(d, "S42", "2026-10-12", "2026-10-16"));
  const keys = (id: string) => view(d, id).keyLabel;
  expect(reasonOf(d, f.last.id).startReason).toEqual({
    kind: "dependency",
    keys: [keys(f.first.id), keys(f.second.id)],
  });
  status(d, f.first.id, "done");
  executeProjectCommand(d, { method: "setTicketOptional", ticketId: f.second.id, optional: true });
  expect(reasonOf(d, f.last.id)).toEqual({ startable: true, startReason: null });
});

test("the last step follows the order of dependencies, not the order of creation", () => {
  const d = newDoc();
  const f = feature(d, "Photos", sprint(d, "S42", "2026-10-12", "2026-10-16"));
  executeProjectCommand(d, { method: "addLink", from: f.last.id, to: f.second.id, type: "blocks" });
  expect(reasonOf(d, f.last.id)).toEqual({ startable: true, startReason: null });
  expect(reasonOf(d, f.second.id).startReason).toEqual({
    kind: "dependency",
    keys: [view(d, f.last.id).keyLabel, view(d, f.first.id).keyLabel],
  });
});

test("a blocking question on a feature holds its steps not started, and blocks the feature", () => {
  const d = newDoc();
  const f = feature(d, "Photos", sprint(d, "S42", "2026-10-12", "2026-10-16"));
  status(d, f.first.id, "in_progress");
  const q = ask(d, f.root.id);
  expect(reasonOf(d, f.second.id).startReason).toEqual({ kind: "question", label: `Q${q.number}` });
  expect(reasonOf(d, f.first.id).startReason).toEqual({ kind: "status" });
  expect(view(d, f.root.id).feature?.status).toBe("open");
  status(d, f.first.id, "done");
  expect(view(d, f.root.id).feature?.status).toBe("blocked");
});
