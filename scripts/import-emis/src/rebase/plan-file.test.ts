import { describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { emisShapedSnapshot } from "../../fixtures/emis-shaped";
import { readOldProject } from "./old-project";
import { buildRebasePlan, parsePlan, serializePlan } from "./plan-file";
import { TODO_PLACEMENT } from "./todo-placement";

const old = readOldProject(emisShapedSnapshot());
const plan = buildRebasePlan({
  old,
  source: "getProject",
  merges: null,
  placement: TODO_PLACEMENT,
  overrides: {},
});

describe("buildRebasePlan", () => {
  test("carries the fingerprint, the velocity and its source, the schedule and the commands", () => {
    expect(plan.version).toBe(1);
    expect(plan.fingerprint).toBe(old.fingerprint);
    expect(plan.velocity).toBe(5);
    expect(plan.velocitySource).toContain("valeur par défaut");
    expect(plan.schedule[0]).toEqual({ id: "F1", sprint: 1, remaining: 4 });
    expect(plan.setup.sprintCount).toBe(Math.max(...plan.schedule.map((s) => s.sprint)));
    expect(plan.commands[0]?.op).toBe("createProject");
    expect(plan.forced).toEqual([]);
    expect(plan.steps).toHaveLength(71);
  });
});

describe("plan file", () => {
  test("a plan written then read back is identical", () => {
    const text = serializePlan(plan);
    expect(JSON.parse(text).mapping.keys[0]).toEqual([old.tickets[0]?.key, "F1"]);
    expect(parsePlan(text)).toEqual(plan);
  });

  test("refuses another version or a broken plan", () => {
    const other = JSON.stringify({ ...JSON.parse(serializePlan(plan)), version: 2 });
    expect(() => parsePlan(other)).toThrow(KiboError);
    expect(() => parsePlan(other)).toThrow(/version/);
    expect(() => parsePlan("{}")).toThrow(KiboError);
  });
});
