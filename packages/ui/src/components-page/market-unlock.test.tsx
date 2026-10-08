import { beforeEach, expect, mock, test } from "bun:test";
import { type MarketHit, type MarketPackageDetail, NO_PERMISSIONS, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        const answer = answers[req.method];
        return answer ? answer() : Promise.resolve([]);
      },
      subscribe: () => () => undefined,
    },
  }),
);

const { MarketplaceTab } = await import("./MarketplaceTab");
const { InstallRefusedDialog } = await import("./InstallRefusedDialog");
const { keyFingerprintHex, shortKeyPrint } = await import("../lib/fingerprint");

const OLD_KEY = "MCowBQYDK2VwAyEAb2xk";
const NEW_KEY = "MCowBQYDK2VwAyEAbmV3";
const source = {
  id: "equipe",
  name: "Équipe",
  url: "https://market.kibo.test/",
  publicKey: "PK",
  fingerprint: "3f9a".repeat(16),
  lastSerial: 42,
  lastFetchedAt: 1,
  lastError: null,
  enabled: true,
};
const hit: MarketHit = {
  sourceId: "equipe",
  sourceName: "Équipe",
  id: "burndown",
  title: "Burndown",
  description: "Reste à faire par jour.",
  kind: "widget",
  latest: "0.4.0",
  publisher: { name: "Léa", publicKey: NEW_KEY, verified: true },
  installed: "0.3.0",
  updateAvailable: "0.4.0",
};
const detail: MarketPackageDetail = {
  ...hit,
  version: "0.4.0",
  hash: "b".repeat(64),
  size: 2048,
  permissions: NO_PERMISSIONS,
  versions: [],
  pinnedPublisher: OLD_KEY,
  newPublisher: false,
  publisherChanged: true,
  files: [],
};
const print = async (key: string) => shortKeyPrint((await keyFingerprintHex(key)) ?? "");

beforeEach(() => {
  calls.length = 0;
  answers = {
    listMarketSources: () => Promise.resolve([source]),
    searchMarket: () => Promise.resolve([hit]),
    getMarketPackage: () => Promise.resolve(detail),
  };
});

test("unlocking from the marketplace confirms the new key, unpins it and reloads the package", async () => {
  render(<MarketplaceTab onInstalled={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Voir Burndown" }));
  await user.click(await screen.findByRole("button", { name: "Débloquer…" }));
  const unlock = await screen.findByRole("dialog", { name: "La clé de l'éditeur a changé" });
  answers.getMarketPackage = () =>
    Promise.resolve({ ...detail, publisherChanged: false, pinnedPublisher: null });
  await user.click(within(unlock).getByRole("button", { name: "Débloquer" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Installer 0.4.0" }).hasAttribute("disabled")).toBe(false),
  );
  expect(calls.filter((c) => c.method === "unpinPublisher")).toEqual([
    { method: "unpinPublisher", sourceId: "equipe", componentId: "burndown" },
  ]);
  expect(calls.filter((c) => c.method === "getMarketPackage").length).toBe(2);
});

test("a key refusal shows the expected and the received fingerprints and offers to unlock", async () => {
  const onUnlock = mock((_: MarketPackageDetail) => {});
  render(
    <InstallRefusedDialog code="PUBLISHER_CHANGED" detail={detail} onClose={() => {}} onUnlock={onUnlock} />,
  );
  const expected = await print(OLD_KEY);
  const received = await print(NEW_KEY);
  expect(await screen.findByText(expected)).toBeTruthy();
  expect(screen.getByText(`${received} (Léa)`)).toBeTruthy();
  expect(screen.getByText("attendu")).toBeTruthy();
  expect(screen.getByText("reçu")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Débloquer…" }));
  expect(onUnlock).toHaveBeenCalledWith(detail);
});

test("a signature refusal names the key the publisher registered", async () => {
  const signed = { ...detail, pinnedPublisher: NEW_KEY, publisherChanged: false };
  render(<InstallRefusedDialog code="SIGNATURE_INVALID" detail={signed} onClose={() => {}} />);
  expect(await screen.findByText(`${await print(NEW_KEY)} (Léa)`)).toBeTruthy();
  expect(screen.queryByText("reçu")).toBeNull();
});
