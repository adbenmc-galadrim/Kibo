import { expect, test } from "bun:test";
import {
  DELIVERY_STEP_LABELS,
  DELIVERY_STEP_MAX,
  DeliveryStep,
  deliveryAgentOf,
  deliveryBrief,
  deliveryStepLabel,
  EMPTY_DELIVERY,
  ProjectDelivery,
  runDeliverySteps,
} from "./delivery";

test("an empty delivery setting is valid and strict", () => {
  expect(ProjectDelivery.parse(EMPTY_DELIVERY)).toEqual(EMPTY_DELIVERY);
  expect(ProjectDelivery.safeParse({ ...EMPTY_DELIVERY, extra: 1 }).success).toBe(false);
  expect(ProjectDelivery.safeParse({}).success).toBe(false);
});

test("delivery fields are bounded and checked", () => {
  const ok = { ...EMPTY_DELIVERY, idPattern: "^C[0-9A-Z]*-[0-9]+$", root: "/Users/a/Documents/emis" };
  expect(ProjectDelivery.safeParse(ok).success).toBe(true);
  expect(ProjectDelivery.safeParse({ ...EMPTY_DELIVERY, idPattern: "x".repeat(201) }).success).toBe(false);
  expect(ProjectDelivery.safeParse({ ...EMPTY_DELIVERY, idPattern: "(" }).success).toBe(false);
  expect(ProjectDelivery.safeParse({ ...EMPTY_DELIVERY, allow: ["Bash"] }).success).toBe(false);
  expect(ProjectDelivery.safeParse({ ...EMPTY_DELIVERY, root: "relative/dir" }).success).toBe(false);
  expect(ProjectDelivery.safeParse({ ...EMPTY_DELIVERY, publication: "draft" }).success).toBe(true);
  expect(ProjectDelivery.safeParse({ ...EMPTY_DELIVERY, publication: "public" }).success).toBe(false);
  expect(ProjectDelivery.safeParse({ ...EMPTY_DELIVERY, agent: "global:full-delivery" }).success).toBe(true);
});

test("a delivery step goes from 0 to 11", () => {
  expect(DELIVERY_STEP_MAX).toBe(11);
  expect(DeliveryStep.parse({ step: 11, note: "", at: 1, runId: null }).step).toBe(11);
  expect(DeliveryStep.safeParse({ step: 12, note: "", at: 1, runId: null }).success).toBe(false);
  expect(DeliveryStep.safeParse({ step: -1, note: "", at: 1, runId: null }).success).toBe(false);
  expect(DeliveryStep.safeParse({ step: 3, note: "x".repeat(301), at: 1, runId: null }).success).toBe(false);
});

test("each step has a French label", () => {
  expect(DELIVERY_STEP_LABELS).toHaveLength(12);
  expect(DELIVERY_STEP_LABELS[0]).toBe("Lecture");
  expect(DELIVERY_STEP_LABELS[11]).toBe("Livré");
  expect(deliveryStepLabel(7)).toBe("7 · Porte qualité");
  expect(deliveryStepLabel(4)).toBe("4 · Worktree");
});

const agent = (ref: string, enabled = true) => {
  const [scope = "global", name = ""] = ref.split(":");
  return {
    ref,
    scope: scope === "global" ? ("global" as const) : ("project" as const),
    name,
    settings: { enabled },
  };
};

test("the delivery agent is the project's choice, else the global full-delivery agent", () => {
  expect(deliveryAgentOf([agent("global:full-delivery")], null)).toBe("global:full-delivery");
  expect(deliveryAgentOf([agent("global:full-delivery", false)], null)).toBeNull();
  expect(deliveryAgentOf([], null)).toBeNull();
  const chosen = { ...EMPTY_DELIVERY, agent: "global:emis-livraison" };
  const agents = [agent("global:full-delivery"), agent("global:emis-livraison")];
  expect(deliveryAgentOf(agents, chosen)).toBe("global:emis-livraison");
  expect(
    deliveryAgentOf([agent("global:full-delivery"), agent("global:emis-livraison", false)], chosen),
  ).toBe("global:full-delivery");
  expect(deliveryAgentOf([agent("global:full-delivery")], chosen)).toBe("global:full-delivery");
});

test("the delivery brief is written by Kibo", () => {
  expect(deliveryBrief("EMIS-15")).toBe("/full-delivery EMIS-15");
});

test("delivery steps of active runs default to an empty list", () => {
  expect(runDeliverySteps({})).toEqual([]);
  expect(runDeliverySteps({ delivery: [{ runId: "r1", step: 7, note: "" }] })).toEqual([
    { runId: "r1", step: 7, note: "" },
  ]);
});
