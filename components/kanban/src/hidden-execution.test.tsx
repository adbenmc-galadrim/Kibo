import { afterEach, expect, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { cleanup, render, screen } from "@testing-library/react";
import { Component, manifest } from "./index";

afterEach(cleanup);

function board(config: Record<string, unknown> = {}) {
  const m = createMockSdk(manifest, {
    viewer: "adam",
    config,
    seed: (run) =>
      run({ method: "createTicket", title: "Schéma", assignee: { kind: "agent", ref: "full-delivery" } }),
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
}

test("a card shows no agent profile", async () => {
  board();
  expect(await screen.findByText("Schéma")).toBeTruthy();
  expect(screen.queryByText("full-delivery")).toBeNull();
});

test("an instance set to « mine » says Moi, not Moi + agents", async () => {
  board({ filter: "mine-and-agents" });
  expect(await screen.findByText("1 ticket · Moi")).toBeTruthy();
  expect(screen.queryByText(/Moi \+ agents/)).toBeNull();
});
