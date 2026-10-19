import { expect, test } from "bun:test";
import { type FeatureStepSource, featureSteps } from "./feature-steps";
import type { OnHold } from "./on-hold";

const step = (id: string, onHold: OnHold | null): FeatureStepSource => ({
  id,
  key: `SILO-${id}`,
  title: `Étape ${id}`,
  parentId: "f5",
  statusId: "todo",
  optional: false,
  delivery: null,
  externalRefs: [],
  onHold,
});

test("each step carries its derived hold", () => {
  const own: OnHold = { source: "own", key: "SILO-33", reason: "R", since: "2026-10-16" };
  const waits: OnHold = { ...own, source: "dependency" };
  const steps = featureSteps({
    feature: "f5",
    tickets: [step("33", own), step("34", waits), step("31", null)],
    links: [{ from: "33", to: "34", type: "blocks" }],
  });
  expect(Object.fromEntries(steps.map((s) => [s.ticketId, s.onHold]))).toEqual({
    "33": own,
    "34": waits,
    "31": null,
  });
});
