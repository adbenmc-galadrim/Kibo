import { expect, test } from "bun:test";
import { PROJECT_AGENT_REF } from "@kibo/schema";
import { fakeCalls, releaseFakeRun } from "./fake-claude-scenario";
import {
  cleanHarness,
  projectAgentAgent,
  run,
  setup,
  startProject,
  waitUntil,
} from "./orchestrator.test-helper";

cleanHarness();

test("the slots of an agent are counted by ref", async () => {
  const h = setup({ profiles: [projectAgentAgent()], scenario: "hold" });
  const first = startProject(h, "p1");
  const second = startProject(h, "p2");
  expect(h.orch.state().queue.find((q) => q.runId === second.id)?.reason).toEqual({
    kind: "agent",
    agentName: "kibo-project-agent",
    used: 1,
    total: 1,
  });
  expect(h.orch.activeRuns(PROJECT_AGENT_REF)).toBe(2);
  expect(run(h, second.id).state).toBe("queued");
  releaseFakeRun(h.state, first.sessionId);
  h.orch.cancel(second.id);
});

test("fallback: the run name opens the first prompt when the CLI refuses --name", async () => {
  const h = setup({
    profiles: [projectAgentAgent()],
    scenario: "done",
    cliFallbacks: { nameInPrompt: true },
  });
  const r = startProject(h);
  await waitUntil(() => run(h, r.id).state === "done");
  const [call] = fakeCalls(h.state, r.sessionId);
  expect(call?.argv).not.toContain("--name");
  expect(call?.prompt).toBe(`# ${r.label}\n\n[tour 1] Où en est-on ?`);
});
