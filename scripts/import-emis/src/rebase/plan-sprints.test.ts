import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { emisShapedSnapshot } from "../../fixtures/emis-shaped";
import { mapProject } from "./mapping";
import { readOldProject } from "./old-project";
import { featureInputs, planSprints, sprintLoads } from "./plan-sprints";
import { TODO_PLACEMENT } from "./todo-placement";

const feature = (id: string, order: number, remaining: number, blockedBy: string[] = []) => ({
  id,
  order,
  remaining,
  blockedBy,
});
const EXAMPLE = [feature("F3", 2, 4, ["F2"]), feature("F1", 0, 5), feature("F2", 1, 3)];

describe("planSprints", () => {
  test("places each feature in the sprint of its last remaining step", () => {
    expect(planSprints(EXAMPLE, 5)).toEqual([
      { id: "F1", sprint: 1 },
      { id: "F2", sprint: 2 },
      { id: "F3", sprint: 3 },
    ]);
    expect(planSprints(EXAMPLE, 4).map((p) => p.sprint)).toEqual([2, 2, 3]);
  });

  test("puts a blocker first, whatever the plan order", () => {
    const plan = planSprints([feature("F1", 0, 2, ["F2"]), feature("F2", 1, 2)], 5);
    expect(plan.map((p) => p.id)).toEqual(["F2", "F1"]);
  });

  test("skips a feature with nothing left and ignores it as a blocker", () => {
    expect(planSprints([feature("F1", 0, 0), feature("F2", 1, 3, ["F1"])], 5)).toEqual([
      { id: "F2", sprint: 1 },
    ]);
  });

  test("refuses a cycle", () => {
    const run = () => planSprints([feature("F1", 0, 1, ["F2"]), feature("F2", 1, 1, ["F1"])], 5);
    expect(run).toThrow(KiboError);
    expect(run).toThrow(/cycle/);
  });

  test("refuses a plan longer than 52 sprints", () => {
    const run = () => planSprints([feature("F1", 0, 300)], 5);
    expect(run).toThrow("plan trop long pour 52 sprints : vitesse 5, 300 étapes");
  });

  test("sprintLoads counts the steps delivered in each sprint", () => {
    expect(sprintLoads(EXAMPLE, 4)).toEqual([4, 4, 4]);
    expect(sprintLoads(EXAMPLE, 5)).toEqual([5, 5, 2]);
  });
});

describe("featureInputs", () => {
  const mapping = mapProject(readOldProject(emisShapedSnapshot()), TODO_PLACEMENT, {});
  const { inputs, ignored } = featureInputs(mapping);
  const input = (id: string) => inputs.find((i) => i.id === id);

  test("counts remaining steps without done or optional ones", () => {
    expect(input("F1")?.remaining).toBe(4);
    expect(input("F3")?.remaining).toBe(3);
    expect(input("F8")?.remaining).toBe(4);
    expect(inputs.map((i) => i.order)).toEqual(inputs.map((_, i) => i));
  });

  test("raises step links to their features, only between unfinished steps", () => {
    expect(input("F4")?.blockedBy).toEqual(["F3"]);
    expect(input("F6")?.blockedBy).toEqual(["F4"]);
    expect(input("F15")?.blockedBy).toEqual(["F1"]);
    expect(input("F2")?.blockedBy).toEqual([]);
    expect(ignored).toEqual([]);
  });

  test("breaks a cycle against the plan order and lists the ignored dependency", () => {
    const keys = (planId: string) => {
      const f = mapping.features.find((x) => x.steps.some((s) => s.ticket.planId === planId));
      return f?.steps.find((s) => s.ticket.planId === planId)?.newKey ?? "";
    };
    const cyclic = {
      ...mapping,
      links: [...mapping.links, { from: keys("C5-4"), to: keys("C3-4"), type: "blocks" as const }],
    };
    const result = featureInputs(cyclic);
    expect(result.ignored).toEqual([{ feature: "F4", blockedBy: "F6" }]);
    expect(() => planSprints(result.inputs, 5)).not.toThrow();
  });
});
