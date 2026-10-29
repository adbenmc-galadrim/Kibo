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
import { openRunRegistry } from "./run-registry";

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

test("a ticket run left in the queue by an older Kibo fails without launching and refuses an answer", async () => {
  const h = setup({ scenario: "done" });
  await h.orch.stop();
  const legacy = openRunRegistry(h.store).create(
    {
      id: "legacy",
      projectId: "p1",
      ticketId: "t1",
      ticketKey: "KIB-1",
      ticketTitle: "Ticket KIB-1",
      profileId: "global:opus",
      profileName: "opus-dev",
      agentScope: "global",
      projectKey: null,
      sessionId: crypto.randomUUID(),
      brief: "",
      kind: "ticket",
      resumedFrom: null,
    },
    0,
  );
  const orch = createOrchestrator(h.options);
  h.route(orch);
  try {
    const view = () => orch.state().runs.find((r) => r.id === legacy.id);
    await waitUntil(() => view()?.state === "failed");
    expect(view()?.error).toStartWith("AGENT_EXECUTION_REMOVED");
    expect(fakeCalls(h.state, legacy.sessionId)).toEqual([]);
    expect(() => orch.answer(legacy.id, "Reprends")).toThrow("AGENT_EXECUTION_REMOVED");
  } finally {
    await orch.stop();
  }
}, 30_000);
