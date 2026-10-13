import { beforeEach, expect, mock, test } from "bun:test";
import { estimateTokens, KiboError, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configFixture, kiboProject, projectsFixture } from "../agents/fixtures";
import { formatTokens } from "../agents/format";
import { apiMock } from "../api-mock";
import { previewBlocks } from "./preview";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return outcome();
      },
    },
  }),
);

const { DomainsPage } = await import("./DomainsPage");
const { SettingsNav } = await import("./SettingsNav");

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
  localStorage.clear();
});

const core = { scope: "domain", domainId: "core", projectId: "kibo" } as const;
type Extra = { projectId?: string; currentProjectId?: string; snapshots?: Map<string, ProjectSnapshot> };
const show = (extra: Extra = {}) =>
  render(<DomainsPage config={configFixture()} projects={projectsFixture} {...extra} />);
const tree = () => within(screen.getByRole("tree", { name: "Dossiers" }));
const item = (name: string) => tree().getByRole("treeitem", { name });
const injection = () =>
  within(screen.getByRole("list", { name: "Injection :" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);
const tokensOf = (owners: (g: ReturnType<typeof configFixture>["guidelines"][number]) => boolean) =>
  `≈ ${formatTokens(
    configFixture()
      .guidelines.filter(owners)
      .reduce((n, g) => n + estimateTokens(g.content), 0),
  )} tokens injectés`;

async function openCore() {
  const user = userEvent.setup();
  await user.click(item("Kibo"));
  await user.click(item("Core"));
  return user;
}

test("the tree shows the workspace open with its domains by name, then one folder per project, current first", () => {
  show({ currentProjectId: "kibo" });
  const names = tree()
    .getAllByRole("treeitem")
    .map((li) => li.getAttribute("aria-label"));
  expect(names).toEqual([
    "Workspace",
    "guidelines/general.md",
    "guidelines/git.md",
    "Domaines du workspace",
    "DevOps",
    "Facturation",
    "Intégrations",
    "Sécurité",
    "UI",
    "Nouveau domaine",
    "Kibo",
    "API Facturation",
  ]);
  expect(item("Workspace").getAttribute("aria-expanded")).toBe("true");
  expect(item("Workspace").getAttribute("aria-selected")).toBe("true");
  expect(within(item("Kibo")).getByText("6 .md")).toBeTruthy();
  expect(within(item("API Facturation")).getByText("0 .md")).toBeTruthy();
  expect(item("Kibo").getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("heading", { name: "Workspace" })).toBeTruthy();
  expect(injection()).toEqual(["Workspace"]);
  expect(screen.queryByRole("combobox")).toBeNull();
});

test("a project folder opens on its own files and domains, never the workspace ones", async () => {
  show();
  await userEvent.setup().click(item("Kibo"));
  expect(item("Kibo").getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("heading", { name: "Projet · Kibo" })).toBeTruthy();
  expect(screen.getByText("3 fichiers · 2 domaines")).toBeTruthy();
  const files = within(screen.getByRole("list", { name: "Projet · Kibo" }));
  expect(files.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "guidelines/kibo.md",
    "guidelines/tests.md",
    "guidelines/ui.md",
  ]);
  expect(item("Core")).toBeTruthy();
  expect(item("Agents")).toBeTruthy();
  expect(injection()).toEqual(["Workspace", "Projet Kibo"]);
  expect(
    screen.getByText(
      tokensOf(
        (g) => g.owner.scope === "workspace" || (g.owner.scope === "project" && g.owner.projectId === "kibo"),
      ),
    ),
  ).toBeTruthy();
});

test("a project domain shows whose it is, its usage, its files and the full chain", async () => {
  show();
  await openCore();
  expect(screen.getByRole("heading", { name: "Domaine · Core" })).toBeTruthy();
  expect(screen.getByText("domaine de Kibo")).toBeTruthy();
  expect(screen.getByText("utilisé par 9 tickets")).toBeTruthy();
  const files = within(screen.getByRole("list", { name: "Domaine · Core" }));
  expect(files.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "guidelines/core.md",
    "skills/loro-patterns.md",
    "guidelines/tests.md",
  ]);
  const editor = screen.getByLabelText<HTMLTextAreaElement>("Contenu de guidelines/core.md");
  expect(editor.value.startsWith("# Guidelines — domaine Core")).toBe(true);
  expect(injection()).toEqual(["Workspace", "Projet Kibo", "Domaine Core"]);
  expect(
    screen.getByText(
      tokensOf(
        (g) =>
          g.owner.scope === "workspace" ||
          (g.owner.scope === "project" && g.owner.projectId === "kibo") ||
          g.owner.scope === "domain",
      ),
    ),
  ).toBeTruthy();
});

test("a workspace domain applies to every local project and counts the projects using it", async () => {
  const other = { ...kiboProject(), meta: { ...kiboProject().meta, id: "fac" } };
  const tickets = (s: ProjectSnapshot) => ({
    ...s,
    tickets: s.tickets.map((t, i) => (i === 0 ? { ...t, domainId: "securite" } : t)),
  });
  show({
    snapshots: new Map([
      ["kibo", tickets(kiboProject())],
      ["fac", tickets(other)],
    ]),
  });
  await userEvent.setup().click(item("Sécurité"));
  expect(screen.getByText("domaine du workspace")).toBeTruthy();
  expect(screen.getByText("utilisé par 3 tickets dans 2 projets")).toBeTruthy();
  expect(injection()).toEqual(["Workspace", "Domaine Sécurité"]);
  expect(screen.getByText("Aucune guideline pour ce domaine.")).toBeTruthy();
});

test("a project domain only counts its own project, even if another one reuses its id", async () => {
  const other = { ...kiboProject(), meta: { ...kiboProject().meta, id: "fac" } };
  show({
    snapshots: new Map([
      ["kibo", kiboProject()],
      ["fac", other],
    ]),
  });
  await openCore();
  expect(screen.getByText("utilisé par 9 tickets")).toBeTruthy();
});

test("an empty project says so, adds a file and creates a domain inside it", async () => {
  show();
  const user = userEvent.setup();
  await user.click(item("API Facturation"));
  expect(item("Aucun fichier")).toBeTruthy();
  expect(screen.getByText("Aucune guideline pour ce projet.")).toBeTruthy();
  expect(screen.getByText(/^Aucun domaine\./)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Ajouter un fichier" }));
  await user.type(screen.getByLabelText("Chemin du fichier"), "guidelines/api.md");
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  await user.click(screen.getByRole("button", { name: "Nouveau domaine" }));
  await user.type(screen.getByLabelText("Nom du domaine"), "Billing{Enter}");
  expect(calls).toEqual([
    {
      method: "config",
      command: {
        method: "addGuideline",
        owner: { scope: "project", projectId: "fac" },
        path: "guidelines/api.md",
        content: "",
      },
    },
    {
      method: "config",
      command: {
        method: "createDomain",
        domain: { name: "Billing", color: "#14B8A6" },
        owner: { scope: "project", projectId: "fac" },
      },
    },
  ]);
});

test("editing a project domain file saves it with its owner, removing it asks the daemon", async () => {
  show();
  const user = await openCore();
  const save = screen.getByRole("button", { name: "Enregistrer" });
  expect(save.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Contenu de guidelines/core.md"), "\n- Nouveau.");
  await user.click(save);
  await user.click(screen.getByRole("button", { name: "Supprimer le fichier" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer guidelines/core.md ?" });
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  const content = configFixture().guidelines.find((g) => g.id === "c1")?.content ?? "";
  expect(calls).toEqual([
    {
      method: "config",
      command: {
        method: "updateGuideline",
        owner: core,
        guidelineId: "c1",
        content: `${content}\n- Nouveau.`,
      },
    },
    { method: "config", command: { method: "removeGuideline", owner: core, guidelineId: "c1" } },
  ]);
});

test("a file is added to a project domain with a checked path", async () => {
  show();
  const user = await openCore();
  await user.click(screen.getByRole("button", { name: "Ajouter un fichier" }));
  const path = screen.getByLabelText("Chemin du fichier");
  await user.type(path, "../etc/passwd.md");
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  expect(screen.getByRole("alert").textContent).toBe(
    "Chemin invalide : minuscules, chiffres et tirets, terminé par .md.",
  );
  await user.clear(path);
  await user.type(path, "guidelines/perf.md");
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  expect(calls).toEqual([
    {
      method: "config",
      command: { method: "addGuideline", owner: core, path: "guidelines/perf.md", content: "" },
    },
  ]);
});

test("a used domain is never deleted; workspace domains are created without owner", async () => {
  show();
  const user = await openCore();
  await user.click(screen.getByRole("button", { name: "Supprimer le domaine Core" }));
  expect(screen.getByRole("alert").textContent).toBe("Ce domaine est utilisé par des tickets.");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  await user.click(item("Facturation"));
  await user.click(screen.getByRole("button", { name: "Supprimer le domaine Facturation" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer le domaine Facturation ?" });
  expect(confirm.textContent).toContain("Aucun fichier de guidelines n'est concerné.");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(screen.getByRole("heading", { name: "Workspace" })).toBeTruthy();
  await user.click(tree().getAllByRole("treeitem", { name: "Nouveau domaine" })[0] as HTMLElement);
  await user.type(screen.getByLabelText("Nom du domaine"), "Conformité{Enter}");
  expect(calls).toEqual([
    {
      method: "config",
      command: { method: "deleteDomain", domainId: "facturation", owner: { scope: "workspace" } },
    },
    {
      method: "config",
      command: { method: "createDomain", domain: { name: "Conformité", color: "#84CC16" } },
    },
  ]);
});

test("renaming or recoloring a project domain names its owner; a duplicate name is explained", async () => {
  show();
  const user = await openCore();
  await user.click(screen.getByRole("button", { name: "Couleur du domaine Core" }));
  await user.click(await screen.findByRole("menuitem", { name: "Couleur #EC4899" }));
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  const field = screen.getByRole("textbox", { name: "Nouveau nom" });
  await user.clear(field);
  await user.type(field, "Noyau{Enter}");
  const owner = { scope: "project", projectId: "kibo" } as const;
  expect(calls).toEqual([
    {
      method: "config",
      command: { method: "updateDomain", domainId: "core", patch: { color: "#EC4899" }, owner },
    },
    {
      method: "config",
      command: { method: "updateDomain", domainId: "core", patch: { name: "Noyau" }, owner },
    },
  ]);
  outcome = () => Promise.reject(new KiboError("INVALID_INPUT", "domain name already used"));
  await user.click(screen.getByRole("button", { name: "Renommer le domaine Core" }));
  await user.clear(screen.getByRole("textbox", { name: "Nouveau nom" }));
  await user.type(screen.getByRole("textbox", { name: "Nouveau nom" }), "Agents{Enter}");
  expect((await screen.findByRole("alert")).textContent).toBe("Un domaine porte déjà ce nom.");
});

test("a refused save is shown", async () => {
  outcome = () => Promise.reject(new KiboError("INVALID_INPUT", "no"));
  show();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Contenu de guidelines/general.md"), "x");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'enregistrer.");
});

test("a read-only project is shown without any way to change it", async () => {
  const kibo = kiboProject();
  show({ snapshots: new Map([["kibo", { ...kibo, sync: { ...kibo.sync, access: "read-only" } }]]) });
  const user = await openCore();
  expect(within(item("Kibo")).getByText("Lecture seule")).toBeTruthy();
  expect(tree().queryAllByRole("treeitem", { name: "Nouveau domaine" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Ajouter un fichier" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Supprimer le domaine Core" })).toBeNull();
  expect(screen.getByLabelText<HTMLTextAreaElement>("Contenu de guidelines/core.md").readOnly).toBe(true);
  await user.click(item("Kibo"));
  expect(screen.getByRole("heading", { name: "Projet · Kibo" })).toBeTruthy();
});

test("the address of a project opens the page on its folder", () => {
  show({ projectId: "fac" });
  expect(item("API Facturation").getAttribute("aria-expanded")).toBe("true");
  expect(item("API Facturation").getAttribute("aria-selected")).toBe("true");
  expect(item("API Facturation").getAttribute("aria-level")).toBe("1");
  expect(screen.getByRole("heading", { name: "Projet · API Facturation" })).toBeTruthy();
});

test("the keyboard opens a node", async () => {
  show();
  const user = userEvent.setup();
  item("Workspace").focus();
  await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
  expect(screen.getByRole("heading", { name: "Domaine · DevOps" })).toBeTruthy();
  await user.keyboard("{End}{Enter}");
  expect(screen.getByRole("heading", { name: "Projet · Kibo" })).toBeTruthy();
});

test("the preview renders headings and bullets", async () => {
  show();
  const user = await openCore();
  await user.click(screen.getByRole("tab", { name: "Aperçu" }));
  expect(screen.getByRole("heading", { name: "Guidelines — domaine Core" })).toBeTruthy();
  expect(screen.getByText("Stocker un secret dans un doc Loro.")).toBeTruthy();
});

test("preview blocks follow the markdown lines", () => {
  expect(previewBlocks("# T\n\n- a\n## S\ntext")).toEqual([
    { kind: "h1", text: "T" },
    { kind: "li", text: "a" },
    { kind: "h2", text: "S" },
    { kind: "p", text: "text" },
  ]);
});

test("settings navigation marks the current page and links every entry", () => {
  render(<SettingsNav active="domains" />);
  const nav = within(screen.getByRole("navigation", { name: "Paramètres" }));
  expect(nav.getByRole("link", { name: "Domaines & guidelines" }).getAttribute("aria-current")).toBe("page");
  expect(nav.getByRole("link", { name: "Général" }).getAttribute("href")).toBe("#/settings/general");
  expect(nav.queryByRole("button")).toBeNull();
});
