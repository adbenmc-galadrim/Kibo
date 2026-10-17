import { afterEach, expect, test } from "bun:test";
import type { AgentExecution } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen } from "@testing-library/react";
import { Component, manifest } from "./index";

afterEach(cleanup);

function board(agentExecution: AgentExecution) {
  const m = createMockSdk(manifest, {
    viewer: "adam",
    agentExecution,
    presence: [
      {
        deviceId: "d2",
        self: false,
        userId: "u-lea",
        name: "Léa",
        pageId: null,
        ticketId: null,
        runs: [{ ticketKey: "KIB-1", profile: "opus-dev-1", state: "running" }],
      },
    ],
    seed: (run) =>
      run({ method: "createTicket", title: "Schéma", assignee: { kind: "agent", ref: "full-delivery" } }),
  });
  const ticketId = m.snapshot().tickets[0]?.id ?? "";
  m.setRuns([{ ticketId, runId: "r1", label: "opus-dev-2", state: "waiting_input", position: null }]);
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
}

test("hidden execution: a card shows no agent profile, no run and no colleague run", async () => {
  board("hidden");
  expect(await screen.findByText("Schéma")).toBeTruthy();
  expect(screen.queryByText("full-delivery")).toBeNull();
  expect(screen.queryByText(/opus-dev/)).toBeNull();
});

test("shown execution: the card shows its run and the colleague run again", async () => {
  board("shown");
  expect(await screen.findByText("opus-dev-2")).toBeTruthy();
  expect(screen.getByText("opus-dev-1 · Léa")).toBeTruthy();
});

test("hidden execution: the filter reads Moi, not Moi + agents", async () => {
  board("hidden");
  expect(await screen.findByRole("radio", { name: "Moi" })).toBeTruthy();
  expect(screen.queryByText(/Moi \+ agents/)).toBeNull();
});

test("shown execution: the filter reads Moi + agents again", async () => {
  board("shown");
  expect(await screen.findByRole("radio", { name: "Moi + agents" })).toBeTruthy();
});
