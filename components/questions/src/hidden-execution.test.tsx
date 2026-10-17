import { afterEach, expect, test } from "bun:test";
import type { AgentExecution, DenialItem, ProjectCommand, Question, RunDenials } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { seedDemo, seedQuestions } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Component, manifest } from "./index";

afterEach(cleanup);

const TITLE = "1 action refusée pendant le run";
const ITEMS: DenialItem[] = [
  { tool: "Bash", target: "pnpm test", rule: "Bash(pnpm *)", addDir: null, reason: "ok" },
];

function denial(agentExecution: AgentExecution) {
  const recorded: Record<string, RunDenials> = {};
  let ticketId = "";
  const seed = (run: (cmd: ProjectCommand) => unknown) => {
    ticketId = seedDemo(run)["KIB-12"] ?? "";
    const q = run({
      method: "createQuestion",
      ticketId,
      title: TITLE,
      context: "Claude Code a refusé ces actions.",
      runId: "r1",
      createdBy: { kind: "agent", ref: "kibo" },
    }) as Question;
    recorded.r1 = { runId: "r1", turn: 3, items: ITEMS, questionId: q.id, at: 1 };
  };
  const m = createMockSdk(manifest, { seed, surface: "view", denials: recorded, agentExecution });
  m.setRuns([{ ticketId, runId: "r1", label: "full-delivery", state: "waiting_input", position: null }]);
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
}

const proposals = async () => {
  const card = await screen.findByRole("article", { name: TITLE });
  return within(await within(card).findByRole("region", { name: "Propositions de Kibo" }));
};

test("hidden execution: a denial offers Ignorer but no « Autoriser et relancer »", async () => {
  denial("hidden");
  const block = await proposals();
  expect(block.getByRole("button", { name: "Ignorer" })).toBeTruthy();
  expect(block.queryByRole("button", { name: "Autoriser et relancer" })).toBeNull();
});

test("shown execution: « Autoriser et relancer » comes back", async () => {
  denial("shown");
  expect((await proposals()).getByRole("button", { name: "Autoriser et relancer" })).toBeTruthy();
});

const answered = (run: (cmd: ProjectCommand) => unknown) => {
  const ids = seedDemo(run);
  seedQuestions(run, [ids["KIB-12"] ?? "", ids["KIB-14"] ?? ""]);
};

function questions(agentExecution: AgentExecution, surface: "view" | "widget") {
  render(
    <SdkProvider sdk={createMockSdk(manifest, { seed: answered, surface, agentExecution }).sdk}>
      <Component />
    </SdkProvider>,
  );
}

test("hidden execution: no « Transmettre à l'agent » in the view nor the widget", async () => {
  for (const surface of ["view", "widget"] as const) {
    questions("hidden", surface);
    await screen.findByText(/Garder l'ordre/);
    expect(screen.queryByRole("button", { name: /Transmettre à l'agent/ })).toBeNull();
    cleanup();
  }
});

test("shown execution: « Transmettre à l'agent » comes back in the view and the widget", async () => {
  for (const surface of ["view", "widget"] as const) {
    questions("shown", surface);
    expect(await screen.findByRole("button", { name: /Transmettre à l'agent/ })).toBeTruthy();
    cleanup();
  }
});
