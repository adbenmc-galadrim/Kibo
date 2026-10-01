import { beforeEach, expect, mock, test } from "bun:test";
import { KiboError, NO_PERMISSIONS, type RpcRequest } from "@kibo/schema";
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

const { PublisherChangedDialog } = await import("../dialogs/PublisherChangedDialog");
const { PublishToMarketDialog } = await import("./PublishToMarketDialog");
const { keyFingerprintHex, groupFingerprint } = await import("../lib/fingerprint");

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
const statik = { ...team, id: "perso", name: "Perso", url: "https://kibo.example.org/" };
const target = {
  id: "burndown",
  title: "Burndown",
  version: "0.3.0",
  hash: "c21e".repeat(16),
  permissions: NO_PERMISSIONS,
};
const online = {
  state: "online",
  serverUrl: "wss://sync.kibo.test",
  user: null,
  deviceId: null,
  retryAt: null,
  lastError: null,
  projects: [],
};
const OLD_KEY = "MCowBQYDK2VwAyEAb2xk";
const NEW_KEY = "MCowBQYDK2VwAyEAbmV3";
const changed = {
  sourceId: "equipe",
  id: "burndown",
  pinnedPublisher: OLD_KEY,
  publisher: { name: "Léa", publicKey: NEW_KEY, verified: true },
};
const publishButton = () => screen.getByRole("button", { name: "Publier" });

beforeEach(() => {
  calls.length = 0;
  answers = {
    listMarketSources: () => Promise.resolve([team, statik]),
    getSyncStatus: () => Promise.resolve(online),
  };
});

test("unlocking a changed publisher key shows both fingerprints and unpins after confirmation", async () => {
  const onUnlocked = mock(() => {});
  render(<PublisherChangedDialog detail={changed} open onOpenChange={() => {}} onUnlocked={onUnlocked} />);
  expect(screen.getByText("Ne débloque que si l'éditeur t'a confirmé ce changement.")).toBeTruthy();
  expect(await screen.findByText("Ancienne clé")).toBeTruthy();
  const [oldPrint, newPrint] = await Promise.all([keyFingerprintHex(OLD_KEY), keyFingerprintHex(NEW_KEY)]);
  expect(screen.getByText(groupFingerprint(oldPrint ?? ""))).toBeTruthy();
  expect(screen.getByText(`${groupFingerprint(newPrint ?? "")} (Léa)`)).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Débloquer" }));
  await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
  expect(calls.at(-1)).toEqual({ method: "unpinPublisher", sourceId: "equipe", componentId: "burndown" });
});

test("unlocking is a local action", async () => {
  render(
    <PublisherChangedDialog detail={changed} open onOpenChange={() => {}} onUnlocked={() => {}} remote />,
  );
  expect(screen.getByRole("button", { name: "Débloquer" }).hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText("Cette action n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
});

test("the first publication asks for a publisher name and only offers team sources", async () => {
  answers.getMarketPublisher = () => Promise.resolve(null);
  answers.publishToMarket = () => Promise.resolve({ serial: 42 });
  render(<PublishToMarketDialog target={target} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  expect(await screen.findByText("Ce nom accompagne tes composants publiés.")).toBeTruthy();
  const source = screen.getByRole("combobox", { name: "Source" });
  expect(source.textContent).toBe("Équipe · https://sync.kibo.test/market/");
  source.focus();
  await user.keyboard("{Enter}");
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
    "Équipe · https://sync.kibo.test/market/",
  ]);
  await user.keyboard("{Escape}");
  await user.type(screen.getByLabelText("Nom d'éditeur"), "Adam");
  await user.click(publishButton());
  expect(await screen.findByText("Publié · version du catalogue 42")).toBeTruthy();
  expect(calls.at(-1)).toEqual({
    method: "publishToMarket",
    id: "burndown",
    version: "0.3.0",
    sourceId: "equipe",
    publisherName: "Adam",
  });
});

test("a known publisher publishes without the name field", async () => {
  answers.getMarketPublisher = () => Promise.resolve({ name: "Adam", fingerprint: "a".repeat(64) });
  answers.publishToMarket = () => Promise.resolve({ serial: 43 });
  render(<PublishToMarketDialog target={target} open onOpenChange={() => {}} />);
  await screen.findByRole("combobox", { name: "Source" });
  expect(screen.queryByLabelText("Nom d'éditeur")).toBeNull();
  await userEvent.setup().click(publishButton());
  await waitFor(() =>
    expect(calls.at(-1)).toEqual({
      method: "publishToMarket",
      id: "burndown",
      version: "0.3.0",
      sourceId: "equipe",
    }),
  );
});

test("publication errors are explained in French", async () => {
  answers.getMarketPublisher = () => Promise.resolve({ name: "Adam", fingerprint: "a".repeat(64) });
  answers.publishToMarket = () => Promise.reject(new KiboError("FORBIDDEN", "x"));
  render(<PublishToMarketDialog target={target} open onOpenChange={() => {}} />);
  await screen.findByRole("combobox", { name: "Source" });
  const user = userEvent.setup();
  await user.click(publishButton());
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Tu n'as pas le droit de publier sur cette source.",
  );
  answers.publishToMarket = () => Promise.reject(new KiboError("REVOKED", "x"));
  await user.click(publishButton());
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Cette version est révoquée."));
});

test("without a team source the dialog says how to get one", async () => {
  answers.listMarketSources = () => Promise.resolve([statik]);
  answers.getMarketPublisher = () => Promise.resolve(null);
  render(<PublishToMarketDialog target={target} open onOpenChange={() => {}} />);
  expect(
    await screen.findByText(
      "Aucune source d'équipe : connecte-toi à un serveur de sync et ajoute sa marketplace.",
    ),
  ).toBeTruthy();
});

test("publishing is a local action", async () => {
  answers.getMarketPublisher = () => Promise.resolve({ name: "Adam", fingerprint: "a".repeat(64) });
  render(<PublishToMarketDialog target={target} open onOpenChange={() => {}} remote />);
  await screen.findByRole("combobox", { name: "Source" });
  expect(publishButton().hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText("Cette action n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
});
