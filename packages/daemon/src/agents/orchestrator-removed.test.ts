import { expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createOrchestrator } from "./orchestrator";
import {
  cleanHarness,
  type Harness,
  projectAgentAgent,
  run,
  setup,
  testAgent,
  waitUntil,
} from "./orchestrator.test-helper";

cleanHarness();

const profiles = [
  testAgent(),
  projectAgentAgent(),
  testAgent({ id: "gen", name: "generateur", permissionMode: "default" }),
];

function bareOrchestrator(h: Harness) {
  const { ticketExecution: _allowed, ...options } = h.options;
  const orch = createOrchestrator(options);
  h.route(orch);
  return orch;
}

test("an orchestrator built without the option refuses ticket runs and queues nothing", async () => {
  const h = setup({ scenario: "done", profiles });
  await h.orch.stop();
  const orch = bareOrchestrator(h);
  try {
    expect(orch.ticketExecution()).toBe("removed");
    const target = { projectId: "p1", ticketId: "t1", profileId: "global:opus", brief: "" };
    expect(() => orch.assign(target)).toThrow("AGENT_EXECUTION_REMOVED");
    expect(orch.state().runs).toEqual([]);
    expect(h.assigned).toEqual([]);
    expect(orch.preview(target)).toMatchObject({ position: null });
  } finally {
    await orch.stop();
  }
});

test("without ticket execution, project runs and component drafts still run and can be answered", async () => {
  const h = setup({ scenario: "done", profiles });
  await h.orch.stop();
  const orch = bareOrchestrator(h);
  try {
    const project = orch.startProjectRun({ projectId: "p1", projectName: "Emis", text: "Où en est-on ?" });
    await waitUntil(() => orch.state().runs.find((r) => r.id === project.id)?.state === "done");
    expect(orch.answer(project.id, "Et EMIS-11 ?").id).toBe(project.id);
    const cwd = join(h.home, "draft");
    mkdirSync(cwd);
    const draft = orch.submit({
      profileId: "global:gen",
      projectId: null,
      title: "Brouillon",
      cwd,
      prompt: "x",
    });
    expect(draft).toMatchObject({ kind: "ticket", ticketId: null });
    await waitUntil(() => orch.state().runs.find((r) => r.id === draft.id)?.state === "done");
  } finally {
    await orch.stop();
  }
});

test("a ticket run recorded before the lock cannot be answered or resumed", async () => {
  const h = setup({ scenario: "done", profiles });
  const ticket = h.orch.assign({ projectId: "p1", ticketId: "t1", profileId: "global:opus", brief: "" });
  await waitUntil(() => run(h, ticket.id).state === "done");
  await h.orch.stop();
  const orch = bareOrchestrator(h);
  try {
    expect(() => orch.answer(ticket.id, "reprends")).toThrow("AGENT_EXECUTION_REMOVED");
    expect(orch.state().runs.find((r) => r.id === ticket.id)?.state).toBe("done");
  } finally {
    await orch.stop();
  }
});
