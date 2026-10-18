import { expect, test } from "bun:test";
import { TUTORIAL_NEVER, type TutorialSeed, type TutorialState } from "@kibo/schema";
import { stepViews } from "./tutorial-steps";

const seed: TutorialSeed = {
  featureIds: ["f1"],
  reviewTicketId: "s4",
  questionId: "q1",
  copyTicketId: "s5",
  overviewPageId: "po",
  planningPageId: "pp",
  kanbanPageId: "pk",
  questionsPageId: "pq",
};
const active: TutorialState = {
  ...TUTORIAL_NEVER,
  status: "active",
  startedAt: 1,
  projectId: "p",
  completed: ["overview"],
  seed,
};
const at = (pageId: string) => ({ kind: "page" as const, projectId: "p", pageId });

test("five tracking steps, each pointing to its page of the demo", () => {
  const views = stepViews(active, "p");
  expect(views.map((v) => [v.step, v.done, v.current])).toEqual([
    ["overview", true, false],
    ["feature", false, true],
    ["review", false, false],
    ["question", false, false],
    ["copy", false, false],
  ]);
  expect(views.map((v) => v.where)).toEqual([at("po"), at("pp"), at("pk"), at("pq"), at("pk")]);
  expect(views.map((v) => v.title)).toEqual([
    "Lire la Vue d'ensemble",
    "Créer une fonctionnalité",
    "Voir une étape passer en review",
    "Répondre à une question",
    "Copier /full-delivery",
  ]);
  expect(views[1]?.instruction).toContain("Planning");
});

test("a tour without seed has steps without destination", () => {
  expect(stepViews({ ...active, seed: null }, "p").every((v) => v.where === null)).toBe(true);
});

test("a finished tour has every step done and none current", () => {
  const done: TutorialState = {
    ...active,
    status: "done",
    completed: ["overview", "feature", "review", "question", "copy"],
  };
  expect(stepViews(done, "p").every((v) => v.done && !v.current)).toBe(true);
});
