import { beforeEach, expect, mock, test } from "bun:test";
import { estimateTokens, KiboError, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { configFixture, projectsFixture } from "../agents/fixtures";
import { formatTokens } from "../agents/format";
import { previewBlocks } from "./preview";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return outcome();
    },
  },
}));

const { DomainsPage } = await import("./DomainsPage");
const { SettingsNav } = await import("./SettingsNav");

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

const core = { scope: "domain", domainId: "core" } as const;
const show = () => render(<DomainsPage config={configFixture()} projects={projectsFixture} />);

test("the first domain opens with its files, usage and injection chain", () => {
  show();
  expect(screen.getByRole("heading", { name: "Domaine · Core" })).toBeTruthy();
  expect(screen.getByText("utilisé par 9 tickets")).toBeTruthy();
  const files = within(screen.getByRole("list", { name: "Domaine · Core" }));
  expect(files.getAllByRole("button").map((b) => b.textContent)).toEqual([
    "guidelines/core.md",
    "skills/loro-patterns.md",
    "guidelines/tests.md",
  ]);
  expect(files.getByRole("button", { name: "guidelines/core.md" }).getAttribute("aria-pressed")).toBe("true");
  const editor = screen.getByLabelText<HTMLTextAreaElement>("Contenu de guidelines/core.md");
  expect(editor.value.startsWith("# Guidelines — domaine Core")).toBe(true);
  const chain = configFixture().guidelines.filter(
    (g) =>
      g.owner.scope === "workspace" ||
      g.owner.scope === "domain" ||
      (g.owner.scope === "project" && g.owner.projectId === "kibo"),
  );
  const tokens = chain.reduce((n, g) => n + estimateTokens(g.content), 0);
  expect(screen.getByText(`≈ ${formatTokens(tokens)} tokens injectés`)).toBeTruthy();
  const injection = within(screen.getByRole("list", { name: "Injection :" }));
  expect(injection.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "Workspace",
    "Projet Kibo",
    "Domaine Core",
  ]);
});

test("levels show their file counts and switch the editor", async () => {
  show();
  const levels = within(screen.getByRole("navigation", { name: "Niveaux" }));
  expect(levels.getByRole("button", { name: "Workspace 2 .md" })).toBeTruthy();
  expect(levels.getByRole("button", { name: "Projet · Kibo 3 .md" })).toBeTruthy();
  await userEvent.setup().click(levels.getByRole("button", { name: "Workspace 2 .md" }));
  expect(screen.getByRole("heading", { name: "Workspace" })).toBeTruthy();
  const files = within(screen.getByRole("list", { name: "Workspace" }));
  expect(files.getByRole("button", { name: "guidelines/general.md" })).toBeTruthy();
  expect(files.getByRole("button", { name: "guidelines/git.md" })).toBeTruthy();
  expect(within(screen.getByRole("list", { name: "Injection :" })).getAllByRole("listitem")).toHaveLength(1);
});

test("editing a file saves its new content, removing it asks the daemon", async () => {
  show();
  const user = userEvent.setup();
  const editor = screen.getByLabelText<HTMLTextAreaElement>("Contenu de guidelines/core.md");
  await user.type(editor, "\n- Nouveau.");
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
  await user.click(screen.getByRole("button", { name: "Supprimer le fichier" }));
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

test("the preview renders headings and bullets", async () => {
  show();
  await userEvent.setup().click(screen.getByRole("tab", { name: "Aperçu" }));
  expect(screen.getByRole("heading", { name: "Guidelines — domaine Core" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "À ne pas faire" })).toBeTruthy();
  expect(screen.getByText("Stocker un secret dans un doc Loro.")).toBeTruthy();
});

test("a file is added with a checked path", async () => {
  show();
  const user = userEvent.setup();
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

test("domains are created with the next palette color, and a used domain is never deleted", async () => {
  show();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Supprimer le domaine Core" }));
  expect(screen.getByRole("alert").textContent).toBe("Ce domaine est utilisé par des tickets.");
  await user.click(screen.getByRole("button", { name: "Facturation" }));
  await user.click(screen.getByRole("button", { name: "Supprimer le domaine Facturation" }));
  await user.click(screen.getByRole("button", { name: "Nouveau domaine" }));
  await user.type(screen.getByLabelText("Nom du domaine"), "Billing");
  await user.click(screen.getByRole("button", { name: "Créer" }));
  expect(calls).toEqual([
    { method: "config", command: { method: "deleteDomain", domainId: "facturation" } },
    { method: "config", command: { method: "createDomain", domain: { name: "Billing", color: "#14B8A6" } } },
  ]);
});

test("a refused save is shown", async () => {
  outcome = () => Promise.reject(new KiboError("INVALID_INPUT", "no"));
  show();
  await userEvent.setup().click(screen.getByRole("button", { name: "Enregistrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'enregistrer.");
});

test("preview blocks follow the markdown lines", () => {
  expect(previewBlocks("# T\n\n- a\n## S\ntext")).toEqual([
    { kind: "h1", text: "T" },
    { kind: "li", text: "a" },
    { kind: "h2", text: "S" },
    { kind: "p", text: "text" },
  ]);
});

test("settings navigation marks the current page and disables the unbuilt ones", () => {
  render(<SettingsNav active="domains" />);
  const nav = within(screen.getByRole("navigation", { name: "Paramètres" }));
  expect(nav.getByRole("link", { name: "Domaines & guidelines" }).getAttribute("aria-current")).toBe("page");
  expect(nav.getByRole("link", { name: "Général" }).getAttribute("href")).toBe("#/settings/general");
  expect(nav.getByRole("link", { name: "Intégrations" }).getAttribute("href")).toBe(
    "#/settings/integrations",
  );
  expect(nav.getByRole("link", { name: "Sécurité" }).getAttribute("href")).toBe("#/settings/security");
  expect(nav.getByRole("button", { name: "Raccourcis" }).hasAttribute("disabled")).toBe(true);
});
