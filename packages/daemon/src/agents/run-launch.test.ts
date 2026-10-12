import { expect, test } from "bun:test";
import type { RunView } from "@kibo/schema";
import { testRef } from "./agents-port.test-helper";
import { fakeCalls } from "./fake-claude-scenario";
import { createOrchestrator } from "./orchestrator";
import { cleanHarness, setup, waitUntil } from "./orchestrator.test-helper";
import type { TurnPrefixPort } from "./orchestrator-types";

cleanHarness();

const SECTION = "## Travail en cours sur le projet\n\n### bou · livraison · BOU-12 · Dates";

function prefixer() {
  const briefs: string[] = [];
  const prompts: { runId: string; turns: number }[] = [];
  const port: TurnPrefixPort = {
    briefSection: async (run: RunView) => {
      briefs.push(run.id);
      return SECTION;
    },
    changedSection: async (run: RunView) => {
      prompts.push({ runId: run.id, turns: run.turns });
      return SECTION;
    },
  };
  return { port, briefs, prompts };
}

test("a ticket run gets the work in progress in its brief, then before each later answer", async () => {
  const h = setup({ scenario: "question" });
  await h.orch.stop();
  const p = prefixer();
  const orch = createOrchestrator({ ...h.options, turnPrefix: p.port });
  h.route(orch);
  try {
    const first = orch.assign({ projectId: "p1", ticketId: "t1", profileId: testRef("opus"), brief: "" });
    const view = () => orch.state().runs.find((r) => r.id === first.id);
    await waitUntil(() => view()?.state === "waiting_input");
    orch.answer(first.id, "Port dynamique");
    await waitUntil(() => view()?.state === "done");
    const calls = fakeCalls(h.state, first.sessionId);
    expect(calls[0]?.prompt).toContain(SECTION);
    expect(calls[1]?.prompt).toBe(`${SECTION}\n\n# Message\n\nPort dynamique`);
    expect(p.briefs).toEqual([first.id]);
    expect(p.prompts).toEqual([{ runId: first.id, turns: 1 }]);
  } finally {
    await orch.stop();
  }
}, 30_000);

test("without a prefixer the later turn is the raw answer", async () => {
  const h = setup({ scenario: "question" });
  const first = h.orch.assign({ projectId: "p1", ticketId: "t1", profileId: testRef("opus"), brief: "" });
  const view = () => h.orch.state().runs.find((r) => r.id === first.id);
  await waitUntil(() => view()?.state === "waiting_input");
  h.orch.answer(first.id, "Port dynamique");
  await waitUntil(() => view()?.state === "done");
  expect(fakeCalls(h.state, first.sessionId)[1]?.prompt).toBe("Port dynamique");
}, 30_000);
