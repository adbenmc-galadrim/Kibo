import { afterEach, expect, test } from "bun:test";
import { type Harness, harness } from "../project-agent/fakes.test-helper";
import { planContext } from "./plan-context";

const open: Harness[] = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

test("the plan context has the project, the viewer and the demo flag, and nothing of the agent", () => {
  const h = harness();
  open.push(h);
  h.ticket("Tournée");
  const ctx = planContext({ ...h.data, isDemoProject: () => true }, h.project.id);
  expect(ctx.project.tickets.map((t) => t.title)).toEqual(["Tournée"]);
  expect(ctx).toMatchObject({
    runs: [],
    notes: [],
    agents: [],
    signals: [],
    closedSignals: [],
    demoProject: true,
    viewer: "adam",
    agentExecution: "hidden",
  });
});
