import { expect, mock, test } from "bun:test";
import type { Environment, RpcRequest, SandboxStatus } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import { apiMock } from "../api-mock";

const env: Environment = {
  daemon: { address: "127.0.0.1:47831", home: "/Users/adam/.kibo" },
  ai: {
    available: true,
    reason: null,
    version: "2.1.283",
    loggedIn: true,
    profiles: { assistant: true, generateur: true },
  },
  git: "2.51",
  gh: "2.80",
  capacity: { cores: 8, ramGb: 16, hostSlots: 3 },
  github: { connected: false },
  app: {
    version: "1.5.0",
    platform: "darwin",
    arch: "arm64",
    home: "~/.kibo",
    userHome: null,
    daemonPid: 42,
    uptimeMs: 0,
    fixedNow: null,
  },
};
let sandbox: SandboxStatus = {
  kind: "bwrap",
  available: true,
  reason: null,
  fix: null,
  allowUnsandboxed: false,
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => Promise.resolve(req.method === "getSandboxStatus" ? sandbox : env),
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);
const { MachineCard } = await import("./MachineCard");

test("the machine diagnostic left the welcome screen for Settings: daemon, capacity, isolation", async () => {
  render(<MachineCard />);
  const card = within(screen.getByRole("region", { name: "Machine" }));
  expect(await card.findByText("127.0.0.1:47831 · données dans ~/.kibo")).toBeTruthy();
  expect(card.getByText("8 cœurs, 16 Go · 3 places pour l'agent de projet")).toBeTruthy();
  expect(await card.findByText("bubblewrap actif")).toBeTruthy();
});

test("a stopped isolation is said with its problem", async () => {
  sandbox = {
    kind: "bwrap",
    available: false,
    reason: "bubblewrap (bwrap) is not installed",
    fix: "sudo apt install bubblewrap",
    allowUnsandboxed: false,
  };
  render(<MachineCard />);
  expect(
    await screen.findByText("⚠ bubblewrap introuvable · les backends sandboxés ne démarreront pas"),
  ).toBeTruthy();
});
