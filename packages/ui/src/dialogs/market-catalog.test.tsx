import { beforeEach, expect, mock, test } from "bun:test";
import {
  KiboError,
  type MarketHit,
  type MarketInstallResult,
  type MarketPackageDetail,
  type MarketSourceInfo,
  NO_PERMISSIONS,
  type RegistryVersion,
  type RpcRequest,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      const answer = answers[req.method];
      return answer ? answer() : Promise.resolve([]);
    },
    subscribe: () => () => undefined,
    subscribeIntegrations: () => () => undefined,
  },
}));

const { AddComponentDialog } = await import("./AddComponentDialog");
const { MarketCatalogSection } = await import("./MarketCatalogSection");

const HASH = `9c41${"0".repeat(56)}7e0b`;
const source: MarketSourceInfo = {
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
const milestones: MarketHit = {
  sourceId: "equipe",
  sourceName: "Équipe",
  id: "milestones",
  title: "Calendrier des jalons",
  description: "Jalons du projet et échéances.",
  kind: "widget",
  latest: "1.2.0",
  publisher: { name: "Léa", publicKey: "LEA", verified: true },
  installed: null,
  updateAvailable: null,
};
const adapter: MarketHit = { ...milestones, id: "jira", title: "Jira", kind: "adapter" };
const detail: MarketPackageDetail = {
  ...milestones,
  version: "1.2.0",
  hash: HASH,
  size: 4096,
  permissions: { ...NO_PERMISSIONS, reads: ["ticket"] },
  versions: [],
  pinnedPublisher: null,
  newPublisher: true,
  publisherChanged: false,
  files: [],
};
const installed: MarketInstallResult = {
  id: "milestones",
  title: "Calendrier des jalons",
  version: "1.2.0",
  hash: HASH,
  permissions: detail.permissions,
  market: { publisherName: "Léa", verified: true, sourceName: "Équipe", newPublisher: true },
};
const approved: RegistryVersion = {
  version: "1.2.0",
  hash: HASH,
  origin: "marketplace",
  trust: "sandboxed",
  approvedHash: HASH,
  granted: detail.permissions,
  publishedAt: 1,
  autoUpdate: false,
  source: null,
  revoked: null,
};
const page = { id: "pg1", title: "Tableau de bord", kind: "dashboard", parentId: null } as const;
const LOCAL_ONLY = "Cette action n'est possible que depuis l'ordinateur où tourne Kibo.";

beforeEach(() => {
  calls.length = 0;
  answers = {
    listMarketSources: () => Promise.resolve([source]),
    searchMarket: () => Promise.resolve([milestones, adapter]),
    getMarketPackage: () => Promise.resolve(detail),
    installFromMarket: () => Promise.resolve(installed),
    approveComponent: () => Promise.resolve(approved),
    command: () => Promise.resolve(null),
  };
});

const renderDialog = () =>
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);

test("screen 3 lists marketplace packages from the cached index, without adapters", async () => {
  renderDialog();
  expect(await screen.findByRole("button", { name: "Voir Calendrier des jalons" })).toBeTruthy();
  expect(screen.getByText("Marketplace")).toBeTruthy();
  expect(screen.getByText("milestones · vérifié · Équipe")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Voir Jira" })).toBeNull();
});

test("the dialog search and the filters query the cached index", async () => {
  renderDialog();
  await screen.findByRole("button", { name: "Voir Calendrier des jalons" });
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Rechercher un composant…"), "jal");
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "searchMarket", query: "jal" }));
  await user.click(screen.getByRole("button", { name: "Type : tous" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Widget" }));
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "searchMarket", query: "jal", kind: "widget" }));
  await user.click(screen.getByRole("button", { name: "Source : toutes" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Équipe" }));
  await waitFor(() =>
    expect(calls.at(-1)).toEqual({
      method: "searchMarket",
      query: "jal",
      sourceId: "equipe",
      kind: "widget",
    }),
  );
});

test("a marketplace hit keeps the no-result line away", async () => {
  renderDialog();
  const user = userEvent.setup();
  await screen.findByRole("button", { name: "Voir Calendrier des jalons" });
  await user.type(screen.getByPlaceholderText("Rechercher un composant…"), "jalons");
  await waitFor(() => expect(calls.at(-1)).toEqual({ method: "searchMarket", query: "jalons" }));
  expect(screen.queryByText("Aucun composant ne correspond.")).toBeNull();
});

test("installing goes through the checks and screen 30, then adds to the current page", async () => {
  renderDialog();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Voir Calendrier des jalons" }));
  await user.click(await screen.findByRole("button", { name: "Installer 1.2.0" }));
  expect(await screen.findByText("Autoriser « Calendrier des jalons » 1.2.0 ?")).toBeTruthy();
  expect(screen.getByText("Publié par Léa · vérifié par Équipe")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Autoriser et ajouter" }));
  await waitFor(() => expect(calls.some((c) => c.method === "command")).toBe(true));
  const writes = calls.filter((c) => ["installFromMarket", "approveComponent", "command"].includes(c.method));
  expect(writes).toEqual([
    { method: "installFromMarket", sourceId: "equipe", id: "milestones", version: "1.2.0" },
    { method: "approveComponent", id: "milestones", version: "1.2.0", hash: HASH, trust: "sandboxed" },
    {
      method: "command",
      projectId: "p1",
      command: {
        method: "addInstance",
        pageId: "pg1",
        component: "milestones@1.2.0",
        layout: { x: 0, y: 0, w: 6, h: 6 },
      },
    },
  ]);
});

test("a refused package shows the translated refusal and adds nothing", async () => {
  answers.installFromMarket = () => Promise.reject(new KiboError("HASH_MISMATCH", "x"));
  renderDialog();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Voir Calendrier des jalons" }));
  await user.click(await screen.findByRole("button", { name: "Installer 1.2.0" }));
  const refusal = await screen.findByRole("dialog", { name: "Installation refusée" });
  expect(within(refusal).getByText("L'empreinte ne correspond pas")).toBeTruthy();
  expect(within(refusal).getByText("Rien n'a été installé.")).toBeTruthy();
  expect(screen.queryByText("Autoriser « Calendrier des jalons » 1.2.0 ?")).toBeNull();
  expect(calls.some((c) => c.method === "approveComponent" || c.method === "command")).toBe(false);
});

test("a remote session cannot install from the catalog and is told why", async () => {
  render(<MarketCatalogSection query="" onCount={() => {}} onInstalled={() => {}} remote />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Voir Calendrier des jalons" }));
  expect(await screen.findByText(LOCAL_ONLY)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Installer 1.2.0" }).hasAttribute("disabled")).toBe(true);
});

test("without any source the section stays hidden", async () => {
  answers.listMarketSources = () => Promise.resolve([]);
  renderDialog();
  expect(await screen.findByRole("radio", { name: "Kanban" })).toBeTruthy();
  await waitFor(() => expect(calls.some((c) => c.method === "listMarketSources")).toBe(true));
  expect(screen.queryByText("Marketplace")).toBeNull();
  expect(calls.some((c) => c.method === "searchMarket")).toBe(false);
});
