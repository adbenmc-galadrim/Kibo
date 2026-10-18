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
  featureIds: [`f${n}`],
  reviewTicketId: "s4",
  questionId: "q1",
  copyTicketId: "s5",
  overviewPageId: "p1",
  planningPageId: "p2",
  kanbanPageId: "p3",
  questionsPageId: "p5",
});
const SNAP: TutorialSnapshot = {
  tickets: [{ id: "s4", statusId: "in_progress", parentId: "f1", shortKey: null }],
  questions: [{ id: "q1", answered: false }],
};
const ALL_STEPS = ["overview", "feature", "review", "question", "copy"] as const;

function setup() {
  const home = mkdtempSync(join(tmpdir(), "kibo-tutorial-"));
  dirs.push(home);
  const store = openStore(home);
  stores.push(store);
  const settings = openLocalSettings(store);
  const created: string[] = [];
  const projects = new Map<string, TutorialSnapshot>();
  const events: Phase7Event[] = [];
  const reviews: string[] = [];
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
    simulateReview: (projectId) => {
      reviews.push(projectId);
      projects.set(projectId, {
        ...SNAP,
        tickets: [{ id: "s4", statusId: "in_review", parentId: "f1", shortKey: null }],
      });
    },
    now: () => 1_000,
  });
  const stored = () => settings.get("tutorial", TutorialState, TUTORIAL_NEVER);
  return { service, created, projects, events, stored, settings, reviews };
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
  s.service.skipStep("overview");
  expect(s.service.pause().status).toBe("paused");
  const resumed = await s.service.start();
  expect([resumed.status, resumed.completed, resumed.projectId]).toEqual(["active", ["overview"], "demo-1"]);
  expect(s.created).toEqual(["demo-1"]);
});

test("start on a paused tutorial whose project was deleted recreates it and keeps completed steps", async () => {
  const s = setup();
  await s.service.start();
  s.service.skipStep("feature");
  s.service.markSeen("overview");
  s.service.pause();
  s.projects.delete("demo-1");
  const resumed = await s.service.start();
  expect(resumed).toEqual({
    status: "active",
    completed: ["overview", "feature"],
    projectId: "demo-2",
    startedAt: 1_000,
    seenViews: ["overview"],
    seed: seedOf(2),
  });
});

test("start after a finished tutorial whose project was deleted begins again", async () => {
  const s = setup();
  await s.service.start();
  for (const step of ALL_STEPS) s.service.skipStep(step);
  expect(s.service.get().status).toBe("done");
  s.projects.delete("demo-1");
  const again = await s.service.start();
  expect([again.status, again.completed, again.projectId]).toEqual(["active", [], "demo-2"]);
});

test("the five tracking steps finish the tutorial, four do not", async () => {
  const s = setup();
  await s.service.start();
  for (const step of ALL_STEPS.slice(0, 4)) s.service.skipStep(step);
  expect(s.service.get().status).toBe("active");
  s.service.skipStep("copy");
  expect(s.service.get().status).toBe("done");
});

test("closing the finished tour is stored: the Bravo panel does not come back", async () => {
  const s = setup();
  await s.service.start();
  expect(s.service.close().status).toBe("active");
  for (const step of ALL_STEPS) s.service.skipStep(step);
  expect(s.service.close().status).toBe("closed");
  expect(s.stored().status).toBe("closed");
  expect(s.service.close().status).toBe("closed");
  s.projects.delete("demo-1");
  const again = await s.service.start();
  expect([again.status, again.completed, again.projectId]).toEqual(["active", [], "demo-2"]);
});

test("the simulated review only acts on the demo of a running tour and completes the review step", async () => {
  const s = setup();
  expect(() => s.service.simulateReview("demo-1")).toThrow("INVALID_INPUT");
  await s.service.start();
  expect(() => s.service.simulateReview("other")).toThrow("INVALID_INPUT");
  expect(s.reviews).toEqual([]);
  const next = s.service.simulateReview("demo-1");
  expect(s.reviews).toEqual(["demo-1"]);
  expect(next.completed).toEqual(["review"]);
  s.service.pause();
  expect(() => s.service.simulateReview("demo-1")).toThrow("INVALID_INPUT");
});

test("a tour stored by an older Kibo is read as closed or never, not as a corrupt store", () => {
  const s = setup();
  const legacy = { ...TUTORIAL_NEVER, status: "done", completed: ["kanban", "agent"], seenViews: ["graph"] };
  s.settings.set("tutorial", legacy);
  expect(s.service.get()).toEqual({ ...TUTORIAL_NEVER, status: "closed" });
  s.settings.set("tutorial", { ...legacy, status: "active" });
  expect(s.service.get()).toEqual(TUTORIAL_NEVER);
});

test("pause, skip, reset and skipStep change the status or the completed list and emit", async () => {
  const s = setup();
  expect(s.service.pause()).toEqual(TUTORIAL_NEVER);
  expect(s.events).toEqual([]);
  await s.service.start();
  expect(s.service.skipStep("review").completed).toEqual(["review"]);
  expect(s.service.skipStep("overview").completed).toEqual(["overview", "review"]);
  expect(s.service.skipStep("overview").completed).toEqual(["overview", "review"]);
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
  s.projects.set("demo-1", { ...SNAP, questions: [{ id: "q1", answered: true }] });
  s.service.refresh();
  expect(s.service.get().completed).toEqual(["question"]);
  expect(s.stored().completed).toEqual(["question"]);
  expect(s.events).toHaveLength(2);
  s.service.refresh();
  expect(s.events).toHaveLength(2);
  s.projects.delete("demo-1");
  s.service.refresh();
  expect(s.events).toHaveLength(2);
});

test("markSeen is idempotent and completes the overview and copy steps", async () => {
  const s = setup();
  await s.service.start();
  const seen = s.service.markSeen("overview");
  expect([seen.seenViews, seen.completed]).toEqual([["overview"], ["overview"]]);
  expect(s.service.markSeen("overview").seenViews).toEqual(["overview"]);
  expect(s.service.markSeen("copy").completed).toEqual(["overview", "copy"]);
  expect(s.stored().seenViews).toEqual(["overview", "copy"]);
  expect(s.events).toHaveLength(3);
});

test("restarting on a demo already played ticks at once the steps it still satisfies", async () => {
  const s = setup();
  await s.service.start();
  s.service.simulateReview("demo-1");
  s.service.reset();
  const again = await s.service.start();
  expect([again.status, again.completed]).toEqual(["active", ["review"]]);
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
