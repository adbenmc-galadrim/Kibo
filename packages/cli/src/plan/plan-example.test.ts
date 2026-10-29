import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NewRef, PlanActions, type ProposedAction } from "@kibo/schema";
import { parsePlanText } from "./plan-file";

const PLAN_EXAMPLE = join(import.meta.dir, "../../../../docs/cli-plan-exemple.yaml");

const ofType = <T extends ProposedAction["type"]>(actions: readonly ProposedAction[], type: T) =>
  actions.filter((a): a is Extract<ProposedAction, { type: T }> => a.type === type);

const ticketRefsOf = (a: ProposedAction): string[] => {
  if (a.type === "createTicket") return a.parent === undefined ? [] : [a.parent];
  if (a.type === "link" || a.type === "unlink") return [a.from, a.to];
  if ("ticket" in a && typeof a.ticket === "string") return [a.ticket];
  return [];
};

describe("docs/cli-plan-exemple.yaml", () => {
  const plan = parsePlanText(readFileSync(PLAN_EXAMPLE, "utf8"), "yaml");

  test("is a valid plan", () => {
    expect(() => PlanActions.parse(plan.actions)).not.toThrow();
    expect(plan.summary).not.toBeNull();
  });

  test("shows a feature, its steps, links, a sprint and a question", () => {
    const created = ofType(plan.actions, "createTicket");
    expect(created.filter((a) => a.feature === true)).toHaveLength(1);
    expect(created.filter((a) => a.parent !== undefined).length).toBeGreaterThanOrEqual(2);
    expect(ofType(plan.actions, "link").length).toBeGreaterThanOrEqual(1);
    expect(ofType(plan.actions, "createSprint")).toHaveLength(1);
    expect(ofType(plan.actions, "setSprint")).toHaveLength(1);
    expect(ofType(plan.actions, "createQuestion")).toHaveLength(1);
  });

  test("refers to tickets by new:n only", () => {
    const refs = plan.actions.flatMap(ticketRefsOf);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(NewRef.safeParse(ref).success).toBe(true);
  });
});
