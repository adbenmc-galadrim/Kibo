import { expect, test } from "bun:test";
import type { Instance, Link, TicketView, TutorialState } from "@kibo/schema";
import { evaluateTutorial, type TutorialRun, type TutorialSnapshot } from "./tutorial-eval";

const SEED = {
  ticketIds: ["t1", "t2"],
  linkKeys: ["t1>t2:blocks"],
  layouts: { w1: { x: 0, y: 0, w: 8, h: 6 } },
  noteHash: "a".repeat(64),
  dashboardPageId: "p1",
  graphPageId: "p2",
};
const ACTIVE: TutorialState = {
  status: "active",
  completed: [],
  projectId: "demo",
  startedAt: 1,
  seenViews: [],
  seed: SEED,
};

const ticket = (id: string, statusId: TicketView["statusId"]): TicketView => ({
  id,
  key: `DEMO-${id}`,
  pendingSeq: null,
  title: id,
  description: "",
  statusId,
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  keyLabel: `DEMO-${id}`,
});
const link = (from: string, to: string): Link => ({ id: `${from}${to}`, from, to, type: "blocks" });
const instance = (id: string, component: string, x = 0): Instance => ({
  id,
  pageId: "p1",
  component,
  layout: { x, y: 0, w: 8, h: 6 },
  config: {},
  componentHash: null,
});
const run = (over: Partial<TutorialRun>): TutorialRun => ({
  profileId: "demo",
  projectId: "demo",
  state: "done",
  ...over,
});

const BASE: TutorialSnapshot = {
  tickets: [ticket("t1", "todo"), ticket("t2", "done")],
  links: [link("t1", "t2")],
  instances: [instance("w1", "kanban@1.0.0")],
  noteHash: SEED.noteHash,
  runs: [],
  aiComponentIds: [],
};
const completedAfter = (snap: Partial<TutorialSnapshot>, state: TutorialState = ACTIVE) =>
  evaluateTutorial(state, { ...BASE, ...snap }).completed;

test("nothing changes when the snapshot equals the seed", () => {
  expect(evaluateTutorial(ACTIVE, BASE)).toBe(ACTIVE);
});

test("kanban: a ticket outside the seed whose status is neither backlog nor todo completes the step", () => {
  expect(completedAfter({ tickets: [...BASE.tickets, ticket("t3", "in_progress")] })).toEqual(["kanban"]);
  expect(completedAfter({ tickets: [...BASE.tickets, ticket("t3", "todo")] })).toEqual([]);
  expect(completedAfter({ tickets: [...BASE.tickets, ticket("t3", "backlog")] })).toEqual([]);
  expect(completedAfter({ tickets: [ticket("t1", "in_progress"), ticket("t2", "done")] })).toEqual([]);
});

test("links: a new link completes only after the graph was seen", () => {
  const links = [...BASE.links, link("t2", "t1")];
  expect(completedAfter({ links })).toEqual([]);
  expect(completedAfter({ links }, { ...ACTIVE, seenViews: ["graph"] })).toEqual(["links"]);
  expect(completedAfter({}, { ...ACTIVE, seenViews: ["graph"] })).toEqual([]);
});

test("note: a different note hash completes the step", () => {
  expect(completedAfter({ noteHash: "b".repeat(64) })).toEqual(["note"]);
  expect(completedAfter({ noteHash: null })).toEqual([]);
});

test("dashboard: a changed layout of a seeded dashboard instance completes the step", () => {
  expect(completedAfter({ instances: [instance("w1", "kanban@1.0.0", 2)] })).toEqual(["dashboard"]);
  expect(completedAfter({ instances: [...BASE.instances, instance("w9", "kanban@1.0.0", 4)] })).toEqual([]);
});

test("agent: a done run of the demo profile on a demo ticket completes the step", () => {
  expect(completedAfter({ runs: [run({})] })).toEqual(["agent"]);
  expect(completedAfter({ runs: [run({ state: "failed" })] })).toEqual([]);
  expect(completedAfter({ runs: [run({ projectId: "other" })] })).toEqual([]);
  expect(completedAfter({ runs: [run({ profileId: "opus-dev" })] })).toEqual([]);
});

test("component: an instance of an ai component on a demo page completes the step", () => {
  const instances = [...BASE.instances, instance("w2", "chart@0.1.0")];
  expect(completedAfter({ instances })).toEqual([]);
  expect(completedAfter({ instances, aiComponentIds: ["chart"] })).toEqual(["component"]);
});

test("all six completed turns the status to done", () => {
  const state: TutorialState = {
    ...ACTIVE,
    completed: ["kanban", "links", "note", "dashboard", "agent"],
  };
  const next = evaluateTutorial(state, {
    ...BASE,
    runs: [],
    noteHash: SEED.noteHash,
    aiComponentIds: ["chart"],
    instances: [...BASE.instances, instance("w2", "chart@0.1.0")],
  });
  expect(next.status).toBe("done");
  expect(next.completed).toEqual(["kanban", "links", "note", "dashboard", "agent", "component"]);
});

test("a paused or skipped state is never advanced", () => {
  const changed = { ...BASE, noteHash: "b".repeat(64) };
  for (const status of ["paused", "skipped", "never", "done"] as const) {
    const state = { ...ACTIVE, status };
    expect(evaluateTutorial(state, changed)).toBe(state);
  }
});
