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
  const after = await h.rpc({ method: "getTutorial" });
  expect(after.completed).toContain("agent");
}, 30_000);
