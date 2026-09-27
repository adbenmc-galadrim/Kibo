import { beforeEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      const a = answers[req.method];
      return a ? a() : Promise.resolve(null);
    },
    subscribe: () => () => undefined,
  },
}));
let members = [
  { userId: "u-lea", name: "Léa", role: "owner" as const },
  { userId: "u-adam", name: "Adam", role: "editor" as const },
];

mock.module("../state/use-projects", () => ({
  useProject: () => ({ sync: { members } }),
  useProjects: () => [],
}));

const { MissingComponent } = await import("./MissingComponent");
const HASH = "c".repeat(64);
const REF = "burndown@0.3.0";
const team = {
  id: "equipe",
  name: "Équipe",
  url: "https://sync.kibo.test/market/",
  publicKey: "PK",
  fingerprint: "f".repeat(64),
  lastSerial: 41,
  lastFetchedAt: 1,
  lastError: null,
  enabled: true,
};

beforeEach(() => {
  calls.length = 0;
  answers = {
    listMarketSources: () => Promise.resolve([team]),
  };
  members = [
    { userId: "u-lea", name: "Léa", role: "owner" as const },
    { userId: "u-adam", name: "Adam", role: "editor" as const },
  ];
});

test("a component offered by a known source can be installed with the same hash", async () => {
  answers.findMarketSource = () => Promise.resolve({ sourceId: "equipe" });
  render(<MissingComponent projectId="p1" componentRef={REF} hash={HASH} compact={false} />);
  expect(screen.getByText("Composant absent : burndown@0.3.0")).toBeTruthy();
  expect(
    await screen.findByText("Disponible sur la marketplace Équipe, avec la même empreinte."),
  ).toBeTruthy();
  expect(calls).toContainEqual({ method: "findMarketSource", id: "burndown", version: "0.3.0", hash: HASH });
  await userEvent.setup().click(screen.getByRole("button", { name: "Installer" }));
  await waitFor(() =>
    expect(calls).toContainEqual({
      method: "getMarketPackage",
      sourceId: "equipe",
      id: "burndown",
      version: "0.3.0",
    }),
  );
});

test("otherwise the owner is asked to publish it", async () => {
  answers.findMarketSource = () => Promise.resolve(null);
  render(<MissingComponent projectId="p1" componentRef={REF} hash={HASH} compact={false} />);
  expect(await screen.findByText("Demande à Léa de le publier sur la marketplace d'équipe.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Installer" })).toBeNull();
});

test("a project that is not shared only states the absence", async () => {
  members = [];
  answers.findMarketSource = () => Promise.resolve(null);
  render(<MissingComponent projectId="p1" componentRef={REF} hash={null} compact />);
  await waitFor(() => expect(calls.map((c) => c.method)).toContain("findMarketSource"));
  expect(screen.getByText("Composant absent : burndown@0.3.0")).toBeTruthy();
  expect(screen.queryByText(/Demande à/)).toBeNull();
});
