import { describe, expect, test } from "bun:test";
import { emisShapedSnapshot } from "../../fixtures/emis-shaped";
import { mapProject } from "./mapping";
import { readOldProject } from "./old-project";
import { featureSprints, planSprints, type StepInput, stepInputs } from "./plan-sprints";
import { TODO_PLACEMENT } from "./todo-placement";

let order = 0;
const steps = (feature: string, count: number, blockedBy: string[] = []): StepInput[] =>
  Array.from({ length: count }, (_, i) => {
    order += 1;
    return { key: `${feature}.${i + 1}`, feature, order, blockedBy: i === 0 ? blockedBy : [] };
  });
const EXAMPLE = [...steps("F1", 5), ...steps("F2", 3), ...steps("F3", 4, ["F2.3"])];
const featureOrder = ["F1", "F2", "F3"];
const sprintsOf = (input: readonly StepInput[], v: number) =>
  featureSprints(planSprints(input, v).slots, featureOrder).map((s) => s.sprint);

describe("planSprints", () => {
  test("a feature ends in the sprint of its last remaining step", () => {
    expect(sprintsOf(EXAMPLE, 5)).toEqual([1, 2, 3]);
    expect(sprintsOf(EXAMPLE, 4)).toEqual([2, 2, 3]);
  });

  test("interleaves features: a blocked step waits, the next free one in plan order takes its slot", () => {
    const input = [
      { key: "A1", feature: "F1", order: 1, blockedBy: [] },
      { key: "A2", feature: "F1", order: 2, blockedBy: ["B1"] },
      { key: "B1", feature: "F2", order: 3, blockedBy: [] },
    ];
    expect(planSprints(input, 2).slots.map((s) => [s.key, s.sprint])).toEqual([
      ["A1", 1],
      ["B1", 1],
      ["A2", 2],
    ]);
  });

  test("a cycle between steps is placed in plan order and reported", () => {
    const input = [
      { key: "A1", feature: "F1", order: 1, blockedBy: ["B1"] },
      { key: "B1", feature: "F2", order: 2, blockedBy: ["A1"] },
    ];
    const plan = planSprints(input, 5);
    expect(plan.slots.map((s) => s.key)).toEqual(["A1", "B1"]);
    expect(plan.forced).toEqual(["A1"]);
  });

  test("refuses a plan longer than 52 sprints", () => {
    const run = () => planSprints(steps("F9", 300), 5);
    expect(run).toThrow("plan trop long pour 52 sprints : vitesse 5, 300 étapes");
  });
});

describe("stepInputs", () => {
  const mapping = mapProject(readOldProject(emisShapedSnapshot()), TODO_PLACEMENT, {});
  const inputs = stepInputs(mapping);
  const keyOf = (planId: string) =>
    mapping.features.flatMap((f) => f.steps).find((s) => s.ticket.planId === planId)?.newKey ?? "";
  const input = (planId: string) => inputs.find((i) => i.key === keyOf(planId));

  test("keeps only remaining steps, in plan order", () => {
    expect(inputs).toHaveLength(71);
    expect(input("C0-1")).toBeUndefined();
    expect(input("C7-5")).toBeUndefined();
    expect(inputs.map((i) => i.order)).toEqual([...inputs.map((i) => i.order)].sort((a, b) => a - b));
  });

  test("keeps links between unfinished steps and spreads feature links over their steps", () => {
    expect(input("C3-1")?.blockedBy).toContain(keyOf("C2-5"));
    expect(input("C0-3")?.blockedBy ?? []).toEqual([]);
    const c2 =
      mapping.features[2]?.steps.filter((s) => s.ticket.statusId !== "done").map((s) => s.newKey) ?? [];
    expect(input("C3-4")?.blockedBy).toEqual(c2);
  });
});
