import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Phase7Event, TUTORIAL_NEVER, type TutorialSeed, TutorialState } from "@kibo/schema";
import { openLocalSettings } from "../settings";
import { openStore, type Store } from "../store";
import type { TutorialSnapshot } from "./tutorial-eval";
import { createTutorialService } from "./tutorial-service";

const dirs: string[] = [];
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const seedOf = (n: number): TutorialSeed => ({
  ticketIds: ["t1"],
  linkKeys: [],
  layouts: {},
  noteHash: `${n}`.repeat(64),
  dashboardPageId: "p1",
  graphPageId: "p2",
});
const SNAP: TutorialSnapshot = {
  tickets: [{ id: "t1", statusId: "todo" }],
  links: [],
  instances: [],
  noteHash: "1".repeat(64),
  runs: [],
  aiComponentIds: [],
};

function setup() {
  const home = mkdtempSync(join(tmpdir(), "kibo-tutorial-"));
  dirs.push(home);
  const store = openStore(home);
  stores.push(store);
  const settings = openLocalSettings(store);
  const created: string[] = [];
  const projects = new Map<string, TutorialSnapshot>();
  const events: Phase7Event[] = [];
  const service = createTutorialService({
    settings,
    createDemo: async () => {
      const projectId = `demo-${created.length + 1}`;
      created.push(projectId);
      projects.set(projectId, SNAP);
      return { projectId, seed: seedOf(created.length) };
    },
    findDemo: () => {
      const projectId = [...projects.keys()].at(-1);
      return projectId === undefined ? null : { projectId, seed: seedOf(9) };
    },
    snapshot: (projectId) => projects.get(projectId) ?? null,
    emit: (e) => events.push(e),
    now: () => 1_000,
  });
  const stored = () => settings.get("tutorial", TutorialState, TUTORIAL_NEVER);
  return { service, created, projects, events, stored };
}

test("start creates the demo project once, stores the seed and emits tutorial.changed", async () => {
  const s = setup();
  expect(s.service.get()).toEqual(TUTORIAL_NEVER);
  const started = await s.service.start();
  expect(started).toEqual({
    status: "active",
    completed: [],
    projectId: "demo-1",
    startedAt: 1_000,
    seenViews: [],
    seed: seedOf(1),
  });
  expect(s.stored()).toEqual(started);
  expect(s.events).toEqual([{ type: "tutorial.changed" }]);
  expect(await s.service.start()).toEqual(started);
  expect(s.created).toEqual(["demo-1"]);
});

test("two concurrent starts create a single demo project", async () => {
  const s = setup();
  const [a, b] = await Promise.all([s.service.start(), s.service.start()]);
  expect(a).toEqual(b);
  expect(s.created).toEqual(["demo-1"]);
});

test("start on a paused tutorial whose project still exists just resumes", async () => {
  const s = setup();
  await s.service.start();
  s.service.skipStep("kanban");
  expect(s.service.pause().status).toBe("paused");
  const resumed = await s.service.start();
  expect([resumed.status, resumed.completed, resumed.projectId]).toEqual(["active", ["kanban"], "demo-1"]);
  expect(s.created).toEqual(["demo-1"]);
});

test("start on a paused tutorial whose project was deleted recreates it and keeps completed steps", async () => {
  const s = setup();
  await s.service.start();
  s.service.skipStep("kanban");
  s.service.markSeen("graph");
  s.service.pause();
  s.projects.delete("demo-1");
  const resumed = await s.service.start();
  expect(resumed).toEqual({
    status: "active",
    completed: ["kanban"],
    projectId: "demo-2",
    startedAt: 1_000,
    seenViews: ["graph"],
    seed: seedOf(2),
  });
});

test("start after a finished tutorial whose project was deleted begins again", async () => {
  const s = setup();
  await s.service.start();
  for (const step of ["kanban", "links", "note", "dashboard", "agent", "component"] as const)
    s.service.skipStep(step);
  expect(s.service.get().status).toBe("done");
  s.projects.delete("demo-1");
  const again = await s.service.start();
  expect([again.status, again.completed, again.projectId]).toEqual(["active", [], "demo-2"]);
});

test("pause, skip, reset and skipStep change the status or the completed list and emit", async () => {
  const s = setup();
  expect(s.service.pause()).toEqual(TUTORIAL_NEVER);
  expect(s.events).toEqual([]);
  await s.service.start();
  expect(s.service.skipStep("note").completed).toEqual(["note"]);
  expect(s.service.skipStep("kanban").completed).toEqual(["kanban", "note"]);
  expect(s.service.skipStep("kanban").completed).toEqual(["kanban", "note"]);
  expect(s.service.pause().status).toBe("paused");
  expect(s.service.skip().status).toBe("skipped");
  expect(s.stored().status).toBe("skipped");
  expect(s.service.reset()).toEqual(TUTORIAL_NEVER);
  expect(s.stored()).toEqual(TUTORIAL_NEVER);
  expect(s.created).toEqual(["demo-1"]);
  expect(s.events).toHaveLength(6);
});

test("refresh evaluates the snapshot and persists only when something changed", async () => {
  const s = setup();
  await s.service.start();
  s.service.refresh();
  expect(s.events).toHaveLength(1);
  s.projects.set("demo-1", { ...SNAP, noteHash: "f".repeat(64) });
  s.service.refresh();
  expect(s.service.get().completed).toEqual(["note"]);
  expect(s.stored().completed).toEqual(["note"]);
  expect(s.events).toHaveLength(2);
  s.service.refresh();
  expect(s.events).toHaveLength(2);
  s.projects.delete("demo-1");
  s.service.refresh();
  expect(s.events).toHaveLength(2);
});

test("markSeen('graph') is idempotent", async () => {
  const s = setup();
  await s.service.start();
  expect(s.service.markSeen("graph").seenViews).toEqual(["graph"]);
  expect(s.service.markSeen("graph").seenViews).toEqual(["graph"]);
  expect(s.stored().seenViews).toEqual(["graph"]);
  expect(s.events).toHaveLength(2);
});

test("start after a reset takes the existing demo project back instead of creating a second one", async () => {
  const s = setup();
  await s.service.start();
  s.service.reset();
  const again = await s.service.start();
  expect([again.status, again.completed, again.projectId, again.seed]).toEqual([
    "active",
    [],
    "demo-1",
    seedOf(9),
  ]);
  expect(s.created).toEqual(["demo-1"]);
});
