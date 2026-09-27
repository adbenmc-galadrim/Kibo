import { beforeEach, expect, mock, test } from "bun:test";
import {
  type ComponentSummary,
  type DraftSummary,
  KiboError,
  type MarketHit,
  type MarketInstallResult,
  NO_PERMISSIONS,
  type PublishPreview,
  type PublishResult,
  type RpcRequest,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const H = "a".repeat(64);
const calls: RpcRequest[] = [];
let components: ComponentSummary[] = [];
let drafts: DraftSummary[] = [];
let preview: () => Promise<PublishPreview> = async () => {
  throw new Error("unset");
};
let publish: () => Promise<PublishResult> = async () => {
  throw new Error("unset");
};
let action: (req: RpcRequest) => Promise<unknown> = async () => null;

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "listComponents") return Promise.resolve(components);
      if (req.method === "listDrafts") return Promise.resolve(drafts);
      if (req.method === "listComponentDrafts") return Promise.resolve([]);
      if (req.method === "getSandboxStatus")
        return Promise.resolve({
          kind: "bwrap",
          available: true,
          reason: null,
          fix: null,
          allowUnsandboxed: false,
        });
      if (req.method === "listProjects")
        return Promise.resolve([
          { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#F97316", counts: {} },
        ]);
      if (req.method === "previewPublish") return preview();
      if (req.method === "publishComponent") return publish();
      return action(req);
    },
    subscribe: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { ComponentsPage } = await import("./ComponentsPage");

const prQueue = (versions: ComponentSummary["versions"]): ComponentSummary => ({
  id: "pr-queue",
  title: "PR en attente",
  builtin: false,
  versions,
});
const dashboard = {
  projectId: "p1",
  projectName: "Kibo",
  pageId: "pg",
  pageTitle: "Tableau de bord",
  instanceId: "i1",
};
const v030 = {
  version: "0.3.0",
  hash: H,
  trust: "sandboxed" as const,
  origin: "ai" as const,
  active: true,
  tampered: false,
  manifest: null,
  usages: [dashboard],
  revoked: null,
};
const basePreview: PublishPreview = {
  id: "pr-queue",
  title: "PR en attente",
  from: "0.3.0",
  to: "0.4.0",
  hash: "b".repeat(64),
  status: "update",
  usages: [{ ...dashboard, version: "0.3.0" }],
  changes: ["Filtre par auteur de la PR"],
  newPermissions: ["net:api.github.com/graphql", "secret:github@api.github.com", "mcp:ctx"],
  migration: { from: 0, to: 1 },
  validation: {
    manifest: { ok: true, errors: [] },
    imports: { ok: true, errors: [] },
    typecheck: { ok: true, errors: [] },
    tests: { ok: true, passed: 9, failed: 0, output: "" },
    conformance: { ok: true, errors: [] },
    permissions: { declared: [], used: [], missing: [], unused: [], errors: [] },
    hash: "b".repeat(64),
    ok: true,
  },
};
const unusedVersion = {} as PublishResult["version"];

beforeEach(() => {
  calls.length = 0;
  components = [prQueue([v030])];
  drafts = [
    {
      id: "pr-queue",
      title: "PR en attente",
      version: "0.4.0",
      hash: "b".repeat(64),
      validated: true,
      publishedVersion: "0.3.0",
    },
  ];
  preview = async () => basePreview;
  publish = async () => ({ version: unusedVersion, needsApproval: false, updated: ["i1"], failed: [] });
  action = async () => null;
});

test("screen 6: the table lists built-ins and installed versions", async () => {
  render(<ComponentsPage />);
  const row = (await screen.findByText("PR en attente", { selector: "td" })).closest("tr");
  expect(row && within(row).getByText("0.3.0")).toBeTruthy();
  expect(row && within(row).getByText("Sandboxé")).toBeTruthy();
  expect(row && within(row).getByText("IA")).toBeTruthy();
  expect(row && within(row).getByText("1 page · 1 projet")).toBeTruthy();
  const kanban = screen.getByText("Kanban").closest("tr");
  expect(kanban && within(kanban).getByText("Intégré")).toBeTruthy();
  expect(
    kanban && within(kanban).getByRole("button", { name: "Actions Kanban 1.0.0" }).hasAttribute("disabled"),
  ).toBe(true);
});

test("D8: the kibo command card lives in the settings, not here", async () => {
  render(<ComponentsPage />);
  expect(await screen.findByRole("button", { name: "Publier" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Installer la commande kibo" })).toBeNull();
});

test("publishing: usages, changes, strategy, then the report", async () => {
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Publier" }));
  expect(await screen.findByText("Publier « PR en attente » 0.4.0")).toBeTruthy();
  expect(screen.getByText("Utilisé dans 1 projet")).toBeTruthy();
  expect(screen.getByText("Filtre par auteur de la PR")).toBeTruthy();
  expect(screen.getByText("Permission net:api.github.com/graphql")).toBeTruthy();
  expect(screen.getByText("Utiliser ton compte GitHub (api.github.com)")).toBeTruthy();
  expect(screen.getByText("Appeler le serveur MCP ctx")).toBeTruthy();
  expect(screen.getByText("Migration de config v0 → v1 (automatique)")).toBeTruthy();
  expect(screen.getByRole("radio", { name: /Mettre à jour partout/ }).getAttribute("data-state")).toBe(
    "checked",
  );
  await user.click(screen.getByRole("radio", { name: /Créer une nouvelle version/ }));
  expect(screen.getByText("Inchangée")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: /Mettre à jour partout/ }));
  await user.click(screen.getByRole("button", { name: "Publier 0.4.0" }));
  await waitFor(() => expect(calls.some((c) => c.method === "publishComponent")).toBe(true));
  expect(calls.find((c) => c.method === "publishComponent")).toEqual({
    method: "publishComponent",
    id: "pr-queue",
    strategy: "update-all",
  });
  expect(await screen.findByText("Version 0.4.0 publiée.")).toBeTruthy();
});

test("D10: a partial failure lists the instances left behind", async () => {
  publish = async () => ({
    version: unusedVersion,
    needsApproval: false,
    updated: [],
    failed: [
      {
        instanceId: "i1",
        projectName: "Kibo",
        pageTitle: "Tableau de bord",
        code: "MIGRATION_FAILED",
        message: "config invalide",
      },
    ],
  });
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Publier" }));
  await user.click(await screen.findByRole("button", { name: "Publier 0.4.0" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("1 instance n'a pas pu être migrée et reste sur l'ancienne version.");
  expect(alert.textContent).toContain("Kibo › Tableau de bord — config invalide");
});

test("publishing errors are explained", async () => {
  for (const [error, text] of [
    [
      new KiboError("VERSION_EXISTS", "x"),
      "Cette version existe déjà avec un autre code. Change la version dans kibo.component.json.",
    ],
    [new KiboError("INVALID_INPUT", "x"), "La version doit être plus haute que la dernière publiée."],
    [new KiboError("FORBIDDEN", "x"), "Cette action n'est possible que depuis l'ordinateur où tourne Kibo."],
  ] as const) {
    preview = async () => {
      throw error;
    };
    const { unmount } = render(<ComponentsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Publier" }));
    expect((await screen.findByRole("alert")).textContent).toBe(text);
    unmount();
  }
  preview = async () => ({ ...basePreview, status: "unchanged" });
  render(<ComponentsPage />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Publier" }));
  expect(
    await screen.findByText("Rien à publier : cette version est déjà publiée avec le même code."),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Publier 0.4.0" })).toBeNull();
});

test("D3: rehash, revoke and uninstall from the ⋯ menu", async () => {
  components = [prQueue([{ ...v030, usages: [] }])];
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions PR en attente 0.3.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Revérifier l'empreinte" }));
  expect(await screen.findByText("Empreinte vérifiée.")).toBeTruthy();
  action = async () => {
    throw new KiboError("TRUST_REQUIRED", "changed");
  };
  await user.click(screen.getByRole("button", { name: "Actions PR en attente 0.3.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Revérifier l'empreinte" }));
  expect(await screen.findByText("L'empreinte a changé : la confiance est redemandée.")).toBeTruthy();
  action = async () => null;
  await user.click(screen.getByRole("button", { name: "Actions PR en attente 0.3.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Retirer la confiance" }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === "revokeComponent")).toEqual({
      method: "revokeComponent",
      id: "pr-queue",
      version: "0.3.0",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Actions PR en attente 0.3.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Désinstaller" }));
  await waitFor(() =>
    expect(calls.find((c) => c.method === "uninstallComponent")).toEqual({
      method: "uninstallComponent",
      id: "pr-queue",
      version: "0.3.0",
    }),
  );
});

test("a used version cannot be uninstalled; a pending one can be reviewed", async () => {
  components = [
    prQueue([
      v030,
      { ...v030, version: "0.4.0", hash: "b".repeat(64), trust: null, active: false, usages: [] },
    ]),
  ];
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions PR en attente 0.3.0" }));
  expect((await screen.findByRole("menuitem", { name: "Désinstaller" })).getAttribute("aria-disabled")).toBe(
    "true",
  );
  await user.keyboard("{Escape}");
  const pending = screen.getByText("Autorisation requise").closest("tr");
  expect(pending && within(pending).getByRole("button", { name: "Examiner" })).toBeTruthy();
});

test("drafts: validated ones can be published, others show the command", async () => {
  drafts = [
    {
      id: "pr-queue",
      title: "PR en attente",
      version: "0.4.0",
      hash: "b".repeat(64),
      validated: true,
      publishedVersion: "0.3.0",
    },
    {
      id: "burndown",
      title: "Burndown",
      version: "0.1.0",
      hash: null,
      validated: false,
      publishedVersion: null,
    },
  ];
  render(<ComponentsPage />);
  expect(await screen.findByText("Brouillons")).toBeTruthy();
  expect(screen.getByText("Tests verts")).toBeTruthy();
  expect(screen.getByText("À valider : kibo component test burndown")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Publier" })).toHaveLength(1);
});

test("modify with AI: only for user and ai components, opens the dialog", async () => {
  components = [
    prQueue([
      v030,
      { ...v030, version: "0.2.0", origin: "marketplace" },
      { ...v030, version: "0.1.0", origin: "user" },
    ]),
  ];
  render(<ComponentsPage />);
  const user = userEvent.setup();
  const entries = async (version: string) => {
    await user.click(await screen.findByRole("button", { name: `Actions PR en attente ${version}` }));
    const names = (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
    await user.keyboard("{Escape}");
    return names.includes("Modifier avec l'IA");
  };
  expect(await entries("0.3.0")).toBe(true);
  expect(await entries("0.2.0")).toBe(false);
  expect(await entries("0.1.0")).toBe(true);
  expect(screen.getByRole("button", { name: "Actions Kanban 1.0.0" }).hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Actions PR en attente 0.1.0" }));
  await user.click(await screen.findByRole("menuitem", { name: "Modifier avec l'IA" }));
  expect(await screen.findByRole("dialog", { name: "Modifier « PR en attente » avec l'IA" })).toBeTruthy();
  expect(screen.getByText("Version actuelle 0.1.0 · origine Toi")).toBeTruthy();
});

test("the components page offers the Installed and Marketplace tabs", async () => {
  action = async () => [];
  render(<ComponentsPage />);
  expect(screen.getByRole("tab", { name: "Installés" }).getAttribute("aria-selected")).toBe("true");
  await userEvent.setup().click(screen.getByRole("tab", { name: "Marketplace" }));
  expect(
    await screen.findByText("Aucune source de marketplace. Ajoute-en une dans Paramètres › Composants."),
  ).toBeTruthy();
});

test("installing from the marketplace opens the approval with the publisher", async () => {
  const hit: MarketHit = {
    sourceId: "equipe",
    sourceName: "Équipe",
    id: "milestones",
    title: "Calendrier des jalons",
    description: "Jalons et échéances des tickets sur un calendrier.",
    kind: "view",
    latest: "1.2.0",
    publisher: { name: "Léa", publicKey: "LEA", verified: true },
    installed: null,
    updateAvailable: null,
  };
  const result: MarketInstallResult = {
    id: "milestones",
    title: "Calendrier des jalons",
    version: "1.2.0",
    hash: H,
    permissions: NO_PERMISSIONS,
    market: { publisherName: "Léa", verified: true, sourceName: "Équipe", newPublisher: true },
  };
  const source = { id: "equipe", name: "Équipe", url: "https://market.kibo.test/", fingerprint: H };
  action = async (req) => {
    if (req.method === "listMarketSources") return [source];
    if (req.method === "searchMarket") return [hit];
    if (req.method === "getMarketPackage")
      return {
        ...hit,
        version: "1.2.0",
        hash: H,
        size: 2048,
        permissions: NO_PERMISSIONS,
        versions: [],
        pinnedPublisher: null,
        newPublisher: true,
        publisherChanged: false,
        files: [],
      };
    if (req.method === "installFromMarket") return result;
    return null;
  };
  render(<ComponentsPage />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Marketplace" }));
  await user.click(await screen.findByRole("button", { name: "Voir Calendrier des jalons" }));
  await user.click(await screen.findByRole("button", { name: "Installer 1.2.0" }));
  const dialog = await screen.findByRole("dialog", { name: "Autoriser « Calendrier des jalons » 1.2.0 ?" });
  expect(within(dialog).getByText("Publié par Léa · vérifié par Équipe")).toBeTruthy();
  expect(within(dialog).getByText("Ce code vient d'une marketplace.")).toBeTruthy();
});
