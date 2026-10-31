import { expect, test } from "bun:test";
import { deliveredToday } from "./delivered-today";
import { build } from "./model-test-kit";
import { featureFacts } from "./overview-facts";
import { TODAY } from "./test-seed";

function facts() {
  const { input } = build();
  return { input, features: featureFacts(input.tickets, input.links) };
}

test("F3 delivered by a pr_merged dated today is listed with its last merge time and PR", () => {
  const { input, features } = facts();
  const [row, ...rest] = deliveredToday(features, input.events, TODAY);
  expect(rest).toEqual([]);
  expect(row).toMatchObject({
    label: "F3",
    title: "Réaffecter un box",
    steps: 4,
    lastMergeAt: Date.parse(`${TODAY}T14:36:00`),
    prNumber: 18,
  });
});

test("a feature delivered yesterday is not", () => {
  const { input, features } = facts();
  expect(deliveredToday(features, input.events, "2026-10-17")).toEqual([]);
});

test("a delivered feature without a dated event is not", () => {
  const { features } = facts();
  expect(deliveredToday(features, [], TODAY)).toEqual([]);
});

test("the last step moved to done counts as the delivery and has no PR", () => {
  const { input, features } = facts();
  const f3 = features.find((f) => f.shortKey === "F3");
  const lastStep = f3?.steps.at(-1);
  if (lastStep === undefined) throw new Error("F3");
  const done = {
    id: 99,
    projectId: "mock",
    at: Date.parse(`${TODAY}T16:00:00`),
    kind: "status_changed" as const,
    ticketId: lastStep.ticketId,
    featureId: null,
    source: "user" as const,
    data: { from: "in_review", to: "done" },
  };
  const [row] = deliveredToday(features, [...input.events, done], TODAY);
  expect(row).toMatchObject({ lastMergeAt: done.at, prNumber: null });
});

test("a status change that is not a move to done does not date the delivery", () => {
  const { features } = facts();
  const f3 = features.find((f) => f.shortKey === "F3");
  const moved = {
    id: 99,
    projectId: "mock",
    at: Date.parse(`${TODAY}T16:00:00`),
    kind: "status_changed" as const,
    ticketId: f3?.steps[0]?.ticketId ?? null,
    featureId: null,
    source: "user" as const,
    data: { from: "todo", to: "in_review" },
  };
  expect(deliveredToday(features, [moved], TODAY)).toEqual([]);
});
