import { beforeEach, expect, mock, test } from "bun:test";
import {
  type ComponentManifest,
  type ComponentSummary,
  type ComponentVersionSummary,
  type MarketComponentStatus,
  NO_PERMISSIONS,
  type RpcRequest,
} from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let answers: Partial<Record<RpcRequest["method"], () => Promise<unknown>>> = {};
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        const a = answers[req.method];
        return a ? a() : Promise.resolve([]);
      },
      subscribe: () => () => undefined,
      subscribeEvents: () => () => undefined,
      subscribeAi: () => () => undefined,
    },
  }),
);

const { ComponentsPage } = await import("./ComponentsPage");
const { MarketUpdateDialog } = await import("./MarketUpdateDialog");

const H = "a".repeat(64);
const usage = (n: number) => ({
  projectId: `p${n}`,
  projectName: `Projet ${n}`,
  pageId: `pg${n}`,
  pageTitle: "Page",
  instanceId: `i${n}`,
});
const version = (over: Partial<ComponentVersionSummary> = {}): ComponentVersionSummary => ({
  version: "0.1.0",
  hash: H,
  trust: "sandboxed",
  origin: "marketplace",
  active: true,
  tampered: false,
  manifest: null,
  usages: [usage(1), usage(2)],
  revoked: null,
  backend: false,
  ...over,
});
const burndown: ComponentSummary = {
  id: "burndown",
  title: "Burndown",
  builtin: false,
  versions: [version()],
};
const roadmap: ComponentSummary = {
  id: "roadmap",
  title: "Feuille de route",
  builtin: false,
  versions: [version({ trust: null, active: false, revoked: { reason: "Faille", at: 1 } })],
};
const statuses: MarketComponentStatus[] = [
  { id: "burndown", version: "0.1.0", sourceId: "equipe", sourceName: "Équipe", updateAvailable: "0.2.0" },
  { id: "roadmap", version: "0.1.0", sourceId: "equipe", sourceName: "Équipe", updateAvailable: null },
];
const detail = {
  sourceId: "equipe",
  sourceName: "Équipe",
  id: "burndown",
  title: "Burndown",
  description: "d",
  kind: "widget",
  latest: "0.2.0",
  publisher: { name: "Léa", publicKey: "LEA", verified: true },
  installed: "0.1.0",
  updateAvailable: "0.2.0",
  version: "0.2.0",
  hash: "b".repeat(64),
  size: 10,
  permissions: NO_PERMISSIONS,
  versions: [],
  pinnedPublisher: "LEA",
  newPublisher: false,
  publisherChanged: false,
  files: [{ path: "kibo.component.json", content: '{"changes":["Ligne idéale"]}' }],
};
const installed = {
  id: "burndown",
  title: "Burndown",
  version: "0.2.0",
  hash: "b".repeat(64),
  permissions: NO_PERMISSIONS,
  market: { publisherName: "Léa", verified: true, sourceName: "Équipe", newPublisher: false },
};
const registryVersion = { version: "0.2.0", hash: "b".repeat(64), origin: "marketplace", trust: "sandboxed" };
const openUpdate = (onDone: () => void, remote = false) =>
  render(
    <MarketUpdateDialog
      title="Burndown"
      summary={version()}
      sourceId="equipe"
      componentId="burndown"
      to="0.2.0"
      onDone={onDone}
      remote={remote}
    />,
  );
const flow = () => calls.map((c) => c.method).filter((m) => m !== "listProjects");

beforeEach(() => {
  calls.length = 0;
  answers = {};
});

test("the installed tab shows the marketplace origin, the update and a revoked version", async () => {
  answers.listComponents = () => Promise.resolve([burndown, roadmap]);
  answers.listMarketStatus = () => Promise.resolve(statuses);
  render(<ComponentsPage onOpen={() => undefined} />);
  expect((await screen.findAllByText("Marketplace · Équipe")).length).toBe(2);
  expect(screen.getByText("0.2.0 disponible")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Mettre à jour" })).toBeTruthy();
  expect(screen.getByText("Révoqué")).toBeTruthy();
  expect(screen.getByText("Révoqué : Faille")).toBeTruthy();
});

test("updating everywhere installs, asks for trust, approves then updates each usage", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  answers.installFromMarket = () => Promise.resolve(installed);
  answers.approveComponent = () => Promise.resolve(registryVersion);
  const onDone = mock(() => {});
  openUpdate(onDone);
  const user = userEvent.setup();
  expect(await screen.findByText("Ligne idéale")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Mettre à jour" }));
  await user.click(await screen.findByRole("radio", { name: "Isolé (recommandé)" }));
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(flow()).toEqual([
    "getMarketPackage",
    "installFromMarket",
    "approveComponent",
    "updateInstance",
    "updateInstance",
  ]);
  expect(calls.slice(-2)).toEqual([
    { method: "updateInstance", projectId: "p1", instanceId: "i1", to: "0.2.0" },
    { method: "updateInstance", projectId: "p2", instanceId: "i2", to: "0.2.0" },
  ]);
});

test("creating a new version leaves the instances alone", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  answers.installFromMarket = () => Promise.resolve(installed);
  answers.approveComponent = () => Promise.resolve(registryVersion);
  const onDone = mock(() => {});
  openUpdate(onDone);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Créer une nouvelle version" }));
  await user.click(screen.getByRole("button", { name: "Mettre à jour" }));
  await user.click(await screen.findByRole("radio", { name: "Isolé (recommandé)" }));
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(flow()).not.toContain("updateInstance");
});

test("a changed publisher opens the unlock dialog instead of the update", async () => {
  answers.getMarketPackage = () =>
    Promise.resolve({ ...detail, publisherChanged: true, pinnedPublisher: "OLD" });
  openUpdate(() => {});
  expect(await screen.findByText("La clé de l'éditeur a changé")).toBeTruthy();
  expect(flow()).not.toContain("installFromMarket");
});

test("a refused installation is explained and nothing is approved", async () => {
  const { KiboError } = await import("@kibo/schema");
  answers.getMarketPackage = () => Promise.resolve(detail);
  answers.installFromMarket = () => Promise.reject(new KiboError("HASH_MISMATCH", "x"));
  openUpdate(() => {});
  await userEvent.setup().click(await screen.findByRole("button", { name: "Mettre à jour" }));
  expect((await screen.findByRole("alert")).textContent).toBe("L'empreinte ne correspond pas.");
  expect(flow()).not.toContain("approveComponent");
});

test("from a remote session the update is disabled and explained", async () => {
  answers.getMarketPackage = () => Promise.resolve(detail);
  openUpdate(() => {}, true);
  await screen.findByText("Ligne idéale");
  expect(screen.getByRole("button", { name: "Mettre à jour" }).hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText("Cette action n'est possible que depuis l'ordinateur où tourne Kibo."),
  ).toBeTruthy();
});

test("an own active component can be published to the marketplace from the ⋯ menu", async () => {
  const manifest: ComponentManifest = {
    id: "pr-queue",
    version: "0.4.0",
    kind: "widget",
    title: "PR en attente",
    description: "",
    reads: ["ticket"],
    writes: [],
    data: false,
    net: [],
    secrets: [],
    mcp: [],
    capabilities: [],
    embeds: [],
    selection: false,
    configVersion: 0,
    changes: [],
    sdk: 1,
  };
  const own: ComponentSummary = {
    id: "pr-queue",
    title: "PR en attente",
    builtin: false,
    versions: [version({ version: "0.4.0", origin: "ai", manifest, usages: [] })],
  };
  answers.listComponents = () => Promise.resolve([own, burndown]);
  answers.listMarketStatus = () => Promise.resolve(statuses);
  answers.getSyncStatus = () => Promise.resolve({ serverUrl: null });
  answers.getMarketPublisher = () => Promise.resolve(null);
  render(<ComponentsPage onOpen={() => undefined} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions pour Burndown 0.1.0" }));
  expect(screen.queryByRole("menuitem", { name: "Publier sur la marketplace" })).toBeNull();
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Actions pour PR en attente 0.4.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Publier sur la marketplace" }));
  expect(await screen.findByRole("dialog", { name: "Publier sur la marketplace" })).toBeTruthy();
  expect(screen.getByText("« PR en attente » 0.4.0 · composant utilisateur")).toBeTruthy();
});
