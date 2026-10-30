import { afterEach, expect, test } from "bun:test";
import { type Harness, harness } from "../project-agent/fakes.test-helper";
import { planContext } from "./plan-context";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

test("the plan context has the project and the viewer, and nothing of the agent", () => {
  const h = harness();
  open.push(h);
  h.ticket("Tournée");
  const ctx = planContext(h.data, h.project.id);
  expect(ctx.project.tickets.map((t) => t.title)).toEqual(["Tournée"]);
  expect(ctx).toMatchObject({ runs: [], notes: [], viewer: "adam" });
  expect(Object.keys(ctx).sort()).toEqual(["notes", "project", "runs", "viewer"]);
});
