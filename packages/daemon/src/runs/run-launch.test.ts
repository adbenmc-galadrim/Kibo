import { expect, test } from "bun:test";
import { join } from "node:path";
import type { Agent } from "@kibo/schema";
import { fakeCalls } from "./fake-claude-scenario";
import { createOrchestrator, type Orchestrator } from "./orchestrator";
import {
  cleanHarness,
  type Harness,
  projectAgentAgent,
  setup,
  testAgent,
  waitUntil,
} from "./orchestrator.test-helper";

cleanHarness();

function withAgent(h: Harness, agent: Agent): Orchestrator {
  const data = { ...h.options.data, agentOf: (ref: string) => (ref === agent.ref ? agent : null) };
  const orch = createOrchestrator({ ...h.options, data });
  h.route(orch);
  return orch;
}

test("a forbidden folder stored on the agent fails the run with its name", async () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "done" });
  await h.orch.stop();
  const agent = testAgent({
    id: "project-agent",
    name: "kibo-project-agent",
    system: true,
    addDirs: [join(h.home, ".kibo")],
  });
  const orch = withAgent(h, agent);
  try {
    const run = orch.startProjectRun({ projectId: "p1", projectName: "Silo", text: "Où en est-on ?" });
    const view = () => orch.state().runs.find((r) => r.id === run.id);
    await waitUntil(() => view()?.state === "failed");
    expect(view()?.error).toContain(".kibo");
    expect(fakeCalls(h.state, run.sessionId)).toEqual([]);
  } finally {
    await orch.stop();
  }
}, 30_000);
