import { expect, mock, test } from "bun:test";
import type { Phase7Event, RpcRequest, SandboxStatus } from "@kibo/schema";
import { act, render, screen, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";

let sandbox: SandboxStatus;
const listeners = new Set<(e: Phase7Event) => void>();

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => {
        if (req.method === "getSandboxStatus") return sandbox;
        throw new Error(`unexpected ${req.method}`);
      },
      subscribeEvents: (l: (e: Phase7Event) => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    },
  }),
);
const { SandboxBanner } = await import("./SandboxBanner");

const missing: SandboxStatus = {
  kind: "bwrap",
  available: false,
  reason: "bubblewrap (bwrap) is not installed",
  fix: "sudo apt install bubblewrap",
  allowUnsandboxed: false,
};

test("the banner shows the stopped backends and the command, then hides on sandbox.changed", async () => {
  sandbox = missing;
  render(<SandboxBanner />);
  expect(
    await screen.findByText("Les backends sandboxés sont arrêtés : isolation OS indisponible."),
  ).toBeTruthy();
  expect(
    screen.getByText("Bubblewrap introuvable. L'interface des composants sandboxés reste utilisable."),
  ).toBeTruthy();
  expect(screen.getByText("sudo apt install bubblewrap")).toBeTruthy();
  sandbox = { ...missing, allowUnsandboxed: true };
  act(() => {
    for (const l of listeners) l({ type: "sandbox.changed" });
  });
  await waitFor(() => expect(screen.queryByText(/backends sandboxés sont arrêtés/)).toBeNull());
});

test("no banner when the isolation works", async () => {
  sandbox = { kind: "bwrap", available: true, reason: null, fix: null, allowUnsandboxed: false };
  const { container } = render(<SandboxBanner />);
  await new Promise((r) => setTimeout(r, 10));
  expect(container.textContent).toBe("");
});
