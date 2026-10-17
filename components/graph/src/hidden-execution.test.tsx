import { afterEach, expect, test } from "bun:test";
import type { AgentExecution, ProjectCommand } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

afterEach(cleanup);

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  run({ method: "createTicket", title: "Chantier", assignee: { kind: "agent", ref: "full-delivery" } });
  run({ method: "createTicket", title: "Amont", assignee: { kind: "human", ref: "adam" } });
};

async function graph(agentExecution: AgentExecution) {
  const m = createMockSdk(manifest, { seed, surface: "view", viewer: "adam", agentExecution });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const canvas = await screen.findByRole("region", { name: "Graphe des dépendances" });
  await within(canvas).findByRole("button", { name: / Chantier$/ });
  const id = m.snapshot().tickets.find((t) => t.title === "Chantier")?.id ?? "";
  act(() =>
    m.setRuns([{ ticketId: id, runId: "r1", label: "opus-dev-1", state: "running", position: null }]),
  );
  return within(canvas);
}

test("hidden execution: a node shows neither its agent icon nor its live run", async () => {
  const canvas = await graph("hidden");
  expect(canvas.queryByLabelText("Assigné à un agent")).toBeNull();
  expect(canvas.queryByRole("button", { name: "opus-dev-1" })).toBeNull();
});

test("shown execution: the agent icon and the live run come back", async () => {
  const canvas = await graph("shown");
  expect(await canvas.findByRole("button", { name: "opus-dev-1" })).toBeTruthy();
});

async function assigneeChoices(agentExecution: AgentExecution): Promise<string[]> {
  await graph(agentExecution);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^(Filtrer|Options)$/ }));
  return (await screen.findAllByRole("menuitemradio")).map((i) => i.textContent ?? "");
}

test("hidden execution: the assignee filter reads Moi, not Moi + agents", async () => {
  const choices = await assigneeChoices("hidden");
  expect(choices).toContain("Moi");
  expect(choices).not.toContain("Moi + agents");
});

test("shown execution: the assignee filter reads Moi + agents again", async () => {
  expect(await assigneeChoices("shown")).toContain("Moi + agents");
});
