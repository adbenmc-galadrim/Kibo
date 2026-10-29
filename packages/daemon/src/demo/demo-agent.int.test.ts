import { afterEach, expect, test } from "bun:test";
import type { RunView } from "@kibo/schema";
import { type AiHarness, startAiHarness } from "../ai/testing/harness";

let h: AiHarness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

async function _waitRun(harness: AiHarness, runId: string, state: RunView["state"]): Promise<RunView> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const { runs } = await harness.rpc({ method: "getAgents" });
    const found = runs.find((r) => r.id === runId);
    if (found?.state === state) return found;
    if (Date.now() > deadline) throw new Error(`run ${runId} is ${found?.state}, expected ${state}`);
    await Bun.sleep(50);
  }
}

test("without claude a draft outside the demo project is still refused", async () => {
  h = await startAiHarness({
    scenario: "onboarding-ok.json",
    claudeBin: "/nonexistent/claude",
  });
  const draft = {
    mode: "create" as const,
    id: "avancement",
    title: "Graphique d'avancement",
    kind: "widget" as const,
    withServer: false,
    description: "Tickets du projet par statut, en barres.",
    template: "chart" as const,
    attachments: [],
  };
  await expect(h.rpc({ method: "startComponentDraft", draft })).rejects.toThrow("AI_UNAVAILABLE");
  await expect(
    h.rpc({ method: "startComponentDraft", draft: { ...draft, projectId: "p-work" } }),
  ).rejects.toThrow("AI_UNAVAILABLE");
}, 30_000);
