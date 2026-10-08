import { afterEach, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { RunView } from "@kibo/schema";
import { type AiHarness, startAiHarness } from "../ai/testing/harness";

let h: AiHarness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

async function waitRun(harness: AiHarness, runId: string, state: RunView["state"]): Promise<RunView> {
  const deadline = Date.now() + 20_000;
  for (;;) {
    const { runs } = await harness.rpc({ method: "getAgents" });
    const found = runs.find((r) => r.id === runId);
    if (found?.state === state) return found;
    if (Date.now() > deadline) throw new Error(`run ${runId} is ${found?.state}, expected ${state}`);
    await Bun.sleep(50);
  }
}

test("the whole demo run goes through the queue, asks a question, resumes and finishes with zero cost", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json", claudeBin: "/nonexistent/claude" });
  const status = await h.rpc({ method: "getAiStatus" });
  expect(status).toMatchObject({ available: false, reason: "missing" });
  expect(Object.keys(status.profiles).sort()).toEqual(["assistant", "generateur"]);
  const tutorial = await h.rpc({ method: "startTutorial" });
  const projectId = tutorial.projectId ?? "";
  const project = await h.rpc({ method: "getProject", projectId });
  const ticket = project.tickets.find((t) => t.key === "DEMO-6");
  if (!ticket) throw new Error("DEMO-6 missing");

  const assigned = await h.rpc({
    method: "assignAgent",
    projectId,
    ticketId: ticket.id,
    profileId: "demo",
    brief: "",
    fresh: false,
  });
  const waiting = await waitRun(h, assigned.id, "waiting_input");
  expect(waiting.question).toBe("Faut-il aussi mettre à jour la documentation ?");
  await h.rpc({ method: "answerRun", runId: assigned.id, text: "Non" });
  const done = await waitRun(h, assigned.id, "done");

  expect(done.tokens).toBe(0);
  expect(done.costUsd).toBe(0);
  expect(done.workspace).toBe("isolated");
  const notes = join(h.home, "runs", assigned.id, "workspace", "notes-de-l-agent.md");
  expect(readFileSync(notes, "utf8")).toContain("Découper le travail");
  expect(existsSync(join(h.home, "demo-agent", "state", `${assigned.sessionId}.calls.jsonl`))).toBe(true);
  await waitTutorial(h, "agent");
}, 30_000);

async function waitTutorial(harness: AiHarness, step: "agent" | "component") {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const t = await harness.rpc({ method: "getTutorial" });
    if (t.completed.includes(step)) return t;
    if (Date.now() > deadline) throw new Error(`step ${step} not completed`);
    await Bun.sleep(50);
  }
}

test("a component draft of the demo project is written by the demo agent, without claude, and ticks step 6", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json", claudeBin: "/nonexistent/claude" });
  const tutorial = await h.rpc({ method: "startTutorial" });
  const projectId = tutorial.projectId ?? "";
  const draft = await h.rpc({
    method: "startComponentDraft",
    draft: {
      mode: "create",
      projectId,
      id: "avancement",
      title: "Graphique d'avancement",
      kind: "widget",
      withServer: false,
      description: "Tickets du projet par statut, en barres.",
      template: "chart",
      attachments: [],
    },
  });
  const review = await h.waitDraft(draft.id, "review", 120_000);
  expect(review.projectId).toBe(projectId);
  const { runs } = await h.rpc({ method: "getAgents" });
  const run = runs.find((r) => r.id === review.runId);
  expect(run).toMatchObject({ profileId: "demo", state: "done", tokens: 0, costUsd: 0 });
  const project = await h.rpc({ method: "getProject", projectId });
  const page = project.pages.find((p) => p.title === "Tableau de bord");
  if (!page) throw new Error("dashboard missing");
  const reviewed = await h.rpc({
    method: "reviewComponentDraft",
    draftId: draft.id,
    version: "0.1.0",
    changes: [],
  });
  const result = await h.rpc({
    method: "finalizeComponentDraft",
    draftId: draft.id,
    version: "0.1.0",
    hash: reviewed.publish?.hash ?? "",
    trust: "sandboxed",
    strategy: "update-all",
    target: { projectId, pageId: page.id },
  });
  expect(result.version).toMatchObject({ origin: "ai" });
  await waitTutorial(h, "component");
}, 180_000);

test("without claude a draft outside the demo project is still refused", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json", claudeBin: "/nonexistent/claude" });
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
