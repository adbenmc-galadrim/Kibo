import { expect, test } from "bun:test";
import type { TutorialState } from "@kibo/schema";
import { evaluateTutorial, type TutorialSnapshot } from "./tutorial-eval";

const SEED = {
  featureIds: ["f1"],
  reviewTicketId: "s4",
  questionId: "q1",
  copyTicketId: "s5",
  overviewPageId: "p1",
  planningPageId: "p2",
  kanbanPageId: "p3",
  questionsPageId: "p5",
};
const ACTIVE: TutorialState = {
  status: "active",
  completed: [],
  projectId: "demo",
  startedAt: 1,
  seenViews: [],
  seed: SEED,
};

type SnapTicket = TutorialSnapshot["tickets"][number];
const ticket = (id: string, over: Partial<SnapTicket> = {}): SnapTicket => ({
  id,
  statusId: "todo",
  parentId: "f1",
  shortKey: null,
  ...over,
});
const BASE: TutorialSnapshot = {
  tickets: [ticket("f1", { parentId: null, shortKey: "F1" }), ticket("s4", { statusId: "in_progress" })],
  questions: [{ id: "q1", answered: false }],
};

test("nothing moves on the seeded demo", () => {
  expect(evaluateTutorial(ACTIVE, BASE)).toBe(ACTIVE);
});

test("reading the overview is the overview view reported by the interface", () => {
  const next = evaluateTutorial({ ...ACTIVE, seenViews: ["overview"] }, BASE);
  expect(next.completed).toEqual(["overview"]);
});

test("a new feature counts, a new step or the seeded feature does not", () => {
  const step = { ...BASE, tickets: [...BASE.tickets, ticket("s9")] };
  expect(evaluateTutorial(ACTIVE, step).completed).toEqual([]);
  const feature = { ...BASE, tickets: [...BASE.tickets, ticket("f9", { parentId: null, shortKey: "F4" })] };
  expect(evaluateTutorial(ACTIVE, feature).completed).toEqual(["feature"]);
});

test("the review step needs the chosen step in review", () => {
  const other = { ...BASE, tickets: [...BASE.tickets, ticket("s3", { statusId: "in_review" })] };
  expect(evaluateTutorial(ACTIVE, other).completed).toEqual([]);
  const moved = {
    ...BASE,
    tickets: [BASE.tickets[0] ?? ticket("f1"), ticket("s4", { statusId: "in_review" })],
  };
  expect(evaluateTutorial(ACTIVE, moved).completed).toEqual(["review"]);
});

test("answering the seeded question completes the question step", () => {
  const answered = { ...BASE, questions: [{ id: "q1", answered: true }] };
  expect(evaluateTutorial(ACTIVE, answered).completed).toEqual(["question"]);
});

test("the last step done finishes the tour, steps keep the tour order", () => {
  const state: TutorialState = { ...ACTIVE, completed: ["overview", "feature", "review", "question"] };
  const done = evaluateTutorial({ ...state, seenViews: ["copy"] }, BASE);
  expect([done.status, done.completed]).toEqual([
    "done",
    ["overview", "feature", "review", "question", "copy"],
  ]);
});

test("a paused tour or a tour without seed is left as is", () => {
  const paused = { ...ACTIVE, status: "paused" as const, seenViews: ["overview" as const] };
  expect(evaluateTutorial(paused, BASE)).toBe(paused);
  const noSeed = { ...ACTIVE, seed: null, seenViews: ["overview" as const] };
  expect(evaluateTutorial(noSeed, BASE)).toBe(noSeed);
});
