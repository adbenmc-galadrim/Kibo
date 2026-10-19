import { expect, test } from "bun:test";
import { effectiveSprintId, featureLabel, isFeature, ShortKey } from "./feature";
import { type FeatureStepSource, featureSteps } from "./feature-steps";
import type { Link } from "./link";

const step = (id: string, over: Partial<FeatureStepSource> = {}): FeatureStepSource => ({
  id,
  key: `SILO-${id}`,
  title: `Étape ${id}`,
  parentId: "f5",
  statusId: "todo",
  optional: false,
  delivery: null,
  externalRefs: [],
  onHold: null,
  ...over,
});

const PR = {
  kind: "github_pr" as const,
  url: "https://github.com/acme/silo/pull/22",
  number: 22,
  state: "open" as const,
  base: "main",
  head: "feat/silo-33",
  review: "none" as const,
  checks: null,
};

test("a feature is a root ticket with children", () => {
  expect(isFeature({ parentId: null, progress: { total: 3 } })).toBe(true);
  expect(isFeature({ parentId: "f5", progress: { total: 2 } })).toBe(false);
  expect(isFeature({ parentId: null, progress: { total: 0 } })).toBe(false);
});

test("a short key is one to three capitals then one to three digits", () => {
  expect(ShortKey.safeParse("F5").success).toBe(true);
  expect(ShortKey.safeParse("C4").success).toBe(true);
  expect(ShortKey.safeParse("ABC123").success).toBe(true);
  expect(ShortKey.safeParse("f5").success).toBe(false);
  expect(ShortKey.safeParse("F").success).toBe(false);
  expect(ShortKey.safeParse("ABCD1").success).toBe(false);
  expect(ShortKey.safeParse("F1234").success).toBe(false);
});

test("a child takes the sprint of its root, three levels down", () => {
  const byId = new Map([
    ["f5", { parentId: null, sprintId: "s42" }],
    ["e33", { parentId: "f5", sprintId: null }],
    ["e33a", { parentId: "e33", sprintId: "ignored" }],
    ["solo", { parentId: null, sprintId: null }],
  ]);
  expect(effectiveSprintId("f5", byId)).toBe("s42");
  expect(effectiveSprintId("e33", byId)).toBe("s42");
  expect(effectiveSprintId("e33a", byId)).toBe("s42");
  expect(effectiveSprintId("solo", byId)).toBeNull();
  expect(effectiveSprintId("unknown", byId)).toBeNull();
});

test("the steps are the direct children, blockers first, then rank", () => {
  const tickets = [
    step("f5", { parentId: null }),
    step("31", { statusId: "done" }),
    step("32"),
    step("33", { statusId: "in_progress" }),
    step("34", { parentId: "33" }),
    step("35", { optional: true }),
    step("other", { parentId: null }),
  ];
  const links: Pick<Link, "from" | "to" | "type">[] = [
    { from: "33", to: "32", type: "blocks" },
    { from: "31", to: "33", type: "blocks" },
    { from: "other", to: "35", type: "blocks" },
    { from: "32", to: "35", type: "relates" },
  ];
  const steps = featureSteps({ feature: "f5", tickets, links });
  expect(steps.map((s) => s.ticketId)).toEqual(["31", "33", "32", "35"]);
  expect(steps.find((s) => s.ticketId === "32")?.blockedBy).toEqual(["SILO-33"]);
  expect(steps.find((s) => s.ticketId === "33")?.blockedBy).toEqual([]);
  expect(steps.find((s) => s.ticketId === "35")?.blockedBy).toEqual(["SILO-other"]);
  expect(steps.find((s) => s.ticketId === "35")?.optional).toBe(true);
});

test("a step carries its status, delivery, branch and pull request", () => {
  const delivery = { step: 7, note: "porte qualité", at: 1, runId: null, kind: "delivery" as const };
  const tickets = [
    step("f5", { parentId: null }),
    step("33", {
      statusId: "in_review",
      delivery,
      externalRefs: [{ kind: "git_branch", branch: "feat/silo-33", base: "main" }, PR],
    }),
    step("34"),
  ];
  const [first, second] = featureSteps({ feature: "f5", tickets, links: [] });
  expect(first).toEqual({
    ticketId: "33",
    key: "SILO-33",
    title: "Étape 33",
    statusId: "in_review",
    optional: false,
    blockedBy: [],
    delivery,
    branch: "feat/silo-33",
    pr: PR,
    onHold: null,
  });
  expect(second?.branch).toBeNull();
  expect(second?.pr).toBeNull();
});

test("a feature without children has no steps", () => {
  expect(featureSteps({ feature: "f9", tickets: [step("f9", { parentId: null })], links: [] })).toEqual([]);
});

test("a feature is named by its short key, else by its own key", () => {
  expect(featureLabel({ key: "SILO-7", shortKey: "F3" })).toBe("F3");
  expect(featureLabel({ key: "F4", shortKey: "F4" })).toBe("F4");
  expect(featureLabel({ key: "SILO-9", shortKey: null })).toBe("SILO-9");
});
