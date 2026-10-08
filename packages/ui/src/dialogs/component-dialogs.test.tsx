import { beforeEach, expect, mock, test } from "bun:test";
import {
  type ComponentManifest,
  type ComponentSummary,
  type ComponentVersionSummary,
  type DraftSummary,
  defaultFormatOf,
  KiboError,
  layoutFor,
  NO_PERMISSIONS,
  type RegistryVersion,
  type RpcRequest,
} from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
const HASH = `${"3f9a".padEnd(60, "0")}c21e`;
let components: () => Promise<ComponentSummary[]> = () => Promise.resolve([]);
let drafts: DraftSummary[] = [];
let approve: () => Promise<unknown> = () => Promise.resolve(null);
let add: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        if (req.method === "listMarketSources") return Promise.resolve([]);
        calls.push(req);
        if (req.method === "listComponents") return components();
        if (req.method === "listDrafts") return Promise.resolve(drafts);
        if (req.method === "approveComponent") return approve();
        if (req.method === "getGithubConnectOptions")
          return Promise.resolve({ ghAvailable: false, ghLogin: null, mode: null });
        if (req.method === "getAiStatus")
          return Promise.resolve({
            available: false,
            reason: "missing",
            version: null,
            loggedIn: null,
            profiles: { assistant: true, generateur: true },
          });
        if (req.method === "listComponentDrafts") return Promise.resolve([]);
        return add();
      },
      subscribe: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
    },
  }),
);

const { AddComponentDialog } = await import("./AddComponentDialog");
const { TrustDialog } = await import("./TrustDialog");
const { CreateComponentDialog } = await import("./CreateComponentDialog");
const { findBuiltin } = await import("../registry");
const kanbanManifest = () => {
  const found = findBuiltin("kanban");
  if (!found) throw new Error("kanban is a built-in");
  return found.manifest;
};

const manifest: ComponentManifest = {
  id: "burndown",
  version: "0.1.0",
  kind: "widget",
  title: "Burndown",
  description: "Tickets restants par jour",
  reads: ["ticket", "status"],
  writes: [],
  data: true,
  net: [],
  secrets: [],
  mcp: [],
  capabilities: [],
  selection: false,
  configVersion: 0,
  changes: [],
  sdk: 1,
};
const pending: ComponentVersionSummary = {
  version: "0.1.0",
  hash: HASH,
  trust: null,
  origin: "ai",
  active: false,
  tampered: false,
  manifest,
  usages: [],
  revoked: null,
  backend: false,
};
const burndown: ComponentSummary = { id: "burndown", title: "Burndown", builtin: false, versions: [pending] };
const approved: RegistryVersion = {
  version: "0.1.0",
  hash: HASH,
  origin: "ai",
  trust: "sandboxed",
  approvedHash: HASH,
  granted: { ...NO_PERMISSIONS, reads: ["ticket", "status"], data: true },
  publishedAt: 1,
  autoUpdate: false,
  source: null,
  revoked: null,
};
const page = { id: "pg1", title: "Tableau de bord", kind: "dashboard", parentId: null } as const;
const search = () => screen.getByPlaceholderText("Rechercher un composant…");

beforeEach(() => {
  calls.length = 0;
  components = () => Promise.resolve([burndown]);
  drafts = [];
  approve = () => Promise.resolve(approved);
  add = () => Promise.resolve(null);
});

test("screen 3: built-ins and my components, search, preview and display", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  expect(await screen.findByRole("radio", { name: "Burndown" })).toBeTruthy();
  expect(screen.getByText("Intégrés")).toBeTruthy();
  expect(screen.getByText("Mes composants")).toBeTruthy();
  expect(screen.getByText("Créé par l'IA · autorisation requise")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  expect(screen.getByText("Widget dans la grille")).toBeTruthy();
  expect(await screen.findByRole("radio", { name: "Synchronisée · GitHub Issues" })).toBeTruthy();
  expect(
    screen.getByText("Intégré · confiance totale · lit : ticket, status, run, runs CI · écrit : ticket"),
  ).toBeTruthy();
  await user.type(search(), "burn");
  expect(screen.queryByRole("radio", { name: "Kanban" })).toBeNull();
  await user.clear(search());
  await user.type(search(), "zzz");
  expect(screen.getByText("Aucun composant ne correspond.")).toBeTruthy();
});

test("a third-party line names origin, trust and network hosts", async () => {
  const prs: ComponentVersionSummary = {
    ...pending,
    version: "0.3.0",
    trust: "sandboxed",
    active: true,
    manifest: { ...manifest, id: "prs", net: ["api.github.com/graphql"] },
  };
  components = () => Promise.resolve([{ ...burndown, id: "prs", title: "PR en attente", versions: [prs] }]);
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  expect(await screen.findByText("Créé par l'IA · isolé · GitHub")).toBeTruthy();
});

test("a built-in is added at the size of its default format in the next free slot", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(
    <AddComponentDialog
      projectId="p1"
      page={page}
      taken={[{ x: 0, y: 0, w: 6, h: 6 }]}
      open
      onOpenChange={onOpenChange}
    />,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Kanban" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "p1",
    command: {
      method: "addInstance",
      pageId: "pg1",
      component: "kanban@1.0.0",
      layout: layoutFor(defaultFormatOf(kanbanManifest()), 6, 0),
    },
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("a third-party widget is added at the size of its only format", async () => {
  const small: ComponentVersionSummary = {
    ...pending,
    trust: "sandboxed",
    active: true,
    manifest: { ...manifest, id: "widget", formats: ["small"] },
  };
  components = () => Promise.resolve([{ ...burndown, id: "widget", title: "Compteur", versions: [small] }]);
  render(
    <AddComponentDialog
      projectId="p1"
      page={page}
      taken={[layoutFor("large", 0, 0)]}
      open
      onOpenChange={() => {}}
    />,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Compteur" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "p1",
    command: {
      method: "addInstance",
      pageId: "pg1",
      component: "widget@0.1.0",
      layout: layoutFor("small", 6, 0),
    },
  });
});

test("a component that is not approved goes through screen 30 before being added", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Burndown" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect(await screen.findByText("Autoriser « Burndown » 0.1.0 ?")).toBeTruthy();
  expect(
    screen.getByText("Composant généré par IA · empreinte sha256 3f9a…c21e · vérifiée par le démon"),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Autoriser et ajouter" }));
  await waitFor(() => expect(calls.some((c) => c.method === "command")).toBe(true));
  expect(calls.filter((c) => c.method !== "listComponents" && c.method !== "listDrafts")).toEqual([
    { method: "approveComponent", id: "burndown", version: "0.1.0", hash: HASH, trust: "sandboxed" },
    {
      method: "command",
      projectId: "p1",
      command: {
        method: "addInstance",
        pageId: "pg1",
        component: "burndown@0.1.0",
        layout: layoutFor("medium", 0, 0),
      },
    },
  ]);
});

test("screen 30 names the capabilities and the shared selection of the version", async () => {
  const rich = { ...pending, manifest: { ...manifest, capabilities: ["gamepad" as const], selection: true } };
  components = () => Promise.resolve([{ ...burndown, versions: [rich] }]);
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Burndown" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect(await screen.findByText("Lire les manettes branchées")).toBeTruthy();
  expect(screen.getByText("Partage la sélection avec les composants de la page")).toBeTruthy();
  expect(screen.getByText("Aucun accès réseau, aucun fichier local")).toBeTruthy();
});

test("refusing on screen 30 adds nothing", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Burndown" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  await user.click(await screen.findByRole("button", { name: "Refuser" }));
  await waitFor(() => expect(screen.queryByText("Autoriser « Burndown » 0.1.0 ?")).toBeNull());
  expect(calls.some((c) => c.method === "approveComponent" || c.method === "command")).toBe(false);
});

test("TrustDialog: full trust is a choice, a changed hash is explained", async () => {
  const onApproved = mock((_: RegistryVersion) => {});
  const target = {
    id: "burndown",
    title: "Burndown",
    version: "0.1.0",
    hash: HASH,
    origin: "ai" as const,
    permissions: approved.granted,
  };
  render(<TrustDialog target={target} mode="approve" open onOpenChange={() => {}} onApproved={onApproved} />);
  const user = userEvent.setup();
  expect(screen.getByText("Lire les tickets du projet")).toBeTruthy();
  expect(screen.getByText("Aucun accès réseau, aucun fichier local")).toBeTruthy();
  expect(screen.getByRole("radio", { name: /Isolé \(recommandé\)/ }).getAttribute("data-state")).toBe(
    "checked",
  );
  expect(screen.getByText(/processus séparé confiné par l'OS/)).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: /Confiance totale/ }));
  approve = () => Promise.reject(new KiboError("HASH_MISMATCH", "changed"));
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Le code a changé depuis l'ouverture de cette fenêtre : vérifie la nouvelle empreinte.",
  );
  expect(calls.at(-1)).toMatchObject({ method: "approveComponent", trust: "trusted" });
  approve = () => Promise.reject(new KiboError("FORBIDDEN", "remote"));
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "Cette action n'est possible que depuis l'ordinateur où tourne Kibo.",
    ),
  );
  approve = () => Promise.resolve(approved);
  await user.click(screen.getByRole("button", { name: "Autoriser" }));
  await waitFor(() => expect(onApproved).toHaveBeenCalledWith(approved));
});

test("TrustDialog with approve delegates the approval instead of calling approveComponent", async () => {
  const onApproved = mock((_: RegistryVersion) => {});
  const delegated = mock((_: "sandboxed" | "trusted") => Promise.resolve(approved));
  const target = {
    id: "burndown",
    title: "Burndown",
    version: "0.1.0",
    hash: HASH,
    origin: "ai" as const,
    permissions: approved.granted,
  };
  render(
    <TrustDialog
      target={target}
      mode="approveAndAdd"
      open
      onOpenChange={() => {}}
      onApproved={onApproved}
      approve={delegated}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Autoriser et ajouter" }));
  await waitFor(() => expect(onApproved).toHaveBeenCalledWith(approved));
  expect(delegated).toHaveBeenCalledWith("sandboxed");
  expect(calls.some((c) => c.method === "approveComponent")).toBe(false);
});

test("a validated draft shows Publier only when the page can publish", async () => {
  drafts = [
    {
      id: "burndown",
      title: "Burndown",
      version: "0.2.0",
      hash: HASH,
      validated: true,
      publishedVersion: "0.1.0",
    },
  ];
  const onPublishDraft = mock((_: string) => {});
  const { unmount } = render(
    <AddComponentDialog
      projectId="p1"
      page={page}
      taken={[]}
      open
      onOpenChange={() => {}}
      onPublishDraft={onPublishDraft}
    />,
  );
  const user = userEvent.setup();
  expect(await screen.findByText("Brouillon")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Publier" }));
  expect(onPublishDraft).toHaveBeenCalledWith("burndown");
  unmount();
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  await screen.findByText("Brouillon");
  expect(screen.queryByRole("button", { name: "Publier" })).toBeNull();
});

test("a failure to load or add is shown, never swallowed", async () => {
  const logged = mock((_: unknown) => {});
  const original = console.error;
  console.error = logged;
  try {
    add = () => Promise.reject(new KiboError("INTERNAL", "boom"));
    const { unmount } = render(
      <AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Kanban" }));
    await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'ajouter le composant.");
    unmount();
    components = () => Promise.reject(new KiboError("INTERNAL", "down"));
    render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Impossible de charger tes composants.");
    expect(logged).toHaveBeenCalledTimes(2);
  } finally {
    console.error = original;
  }
});

test("screen 29: the AI column explains a blocked agent, commands can be copied", async () => {
  render(<CreateComponentDialog open onOpenChange={() => {}} target={null} />);
  const user = userEvent.setup();
  const writes: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: async (t: string) => writes.push(t) },
    configurable: true,
  });
  expect(await screen.findByText("claude introuvable")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Générer avec un agent/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByText("Bientôt")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Copier les commandes" }));
  expect(writes).toEqual([
    "kibo component new burndown\nkibo component test burndown\nkibo component dev burndown",
  ]);
  expect(await screen.findByText("Commandes copiées.")).toBeTruthy();
  expect(screen.getAllByText(/^\d · /).map((e) => e.textContent)).toEqual([
    "1 · Décrire",
    "2 · Générer (agent)",
    "3 · Tests de conformité",
    "4 · Permissions",
    "5 · Ajouter à la page",
  ]);
});
