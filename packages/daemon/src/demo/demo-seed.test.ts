import { expect, test } from "bun:test";
import { StatusId } from "@kibo/schema";
import { DEMO_FEATURES, DEMO_LINKS, DEMO_QUESTION, DEMO_ROLES, demoSetup } from "./demo-seed";

const steps = DEMO_FEATURES.flatMap((f) => f.steps);
const byNumber = (a: string, b: string) => Number(a.split("-")[1]) - Number(b.split("-")[1]);

test("three features over the three sprints, their steps keyed DEMO-1 to DEMO-8", () => {
  expect(DEMO_FEATURES.map((f) => f.sprint)).toEqual([0, 1, 2]);
  expect(steps.map((s) => s.key).sort(byNumber)).toEqual([
    "DEMO-1",
    "DEMO-2",
    "DEMO-3",
    "DEMO-4",
    "DEMO-5",
    "DEMO-6",
    "DEMO-7",
    "DEMO-8",
  ]);
  for (const s of steps) expect(StatusId.safeParse(s.status).success).toBe(true);
});

test("one step in review with an open pull request, one in progress on a branch", () => {
  const inReview = steps.filter((s) => s.status === "in_review");
  expect(inReview.map((s) => [s.key, s.pr?.state])).toEqual([["DEMO-3", "open"]]);
  const review = steps.find((s) => s.key === DEMO_ROLES.review);
  expect([review?.status, review?.branch]).toEqual(["in_progress", "demo/paiement"]);
  expect(steps.find((s) => s.key === DEMO_ROLES.copy)?.status).toBe("todo");
});

test("the step to copy is not the last of its feature, so it can start before the others are done", () => {
  const feature = DEMO_FEATURES.find((f) => f.steps.some((s) => s.key === DEMO_ROLES.copy));
  expect(feature?.steps.at(-1)?.key).not.toBe(DEMO_ROLES.copy);
  expect(feature?.steps.at(-1)?.key).toBe("DEMO-8");
});

test("a blocking question for the client on a step of the last feature", () => {
  expect(DEMO_QUESTION.blocking).toBe(true);
  expect(DEMO_QUESTION.recipient).toBe("client");
  expect(DEMO_FEATURES[2]?.steps.map((s) => s.key)).toContain(DEMO_QUESTION.on);
  for (const l of DEMO_LINKS) expect(steps.map((s) => s.key)).toEqual(expect.arrayContaining([l.from, l.to]));
});

test("three one-week sprints: the last week, this work week and the next one", () => {
  expect(demoSetup("2026-10-21")).toEqual({ sprintStart: "2026-10-12", sprintCount: 3, sprintWeeks: 1 });
  expect(demoSetup("2026-10-19").sprintStart).toBe("2026-10-12");
  expect(demoSetup("2026-10-23").sprintStart).toBe("2026-10-12");
  expect(demoSetup("2026-10-24").sprintStart).toBe("2026-10-19");
  expect(demoSetup("2026-10-18").sprintStart).toBe("2026-10-12");
});
