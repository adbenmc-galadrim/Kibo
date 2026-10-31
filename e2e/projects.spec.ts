import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { homeOf } from "./e2e-home";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { openNewProject } from "./helpers";
import { projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const notificationPermissionDefault = () => {
  Object.defineProperty(Notification, "permission", { configurable: true, get: () => "default" });
};

const CLI = join(import.meta.dirname, "..", "packages", "cli", "src", "bin.ts");
const SETUP_PAGES = ["Vue d'ensemble", "Planning", "Kanban", "Graphe", "Questions"];

type NewProject = { name: string; key: string; client?: string; folder?: string };

async function fillNewProject(page: Page, project: NewProject) {
  await openNewProject(page);
  const dialog = page.getByRole("dialog", { name: "Nouveau projet" });
  await dialog.getByLabel("Nom", { exact: true }).fill(project.name);
  await dialog.getByLabel("Clé", { exact: true }).fill(project.key);
  if (project.client !== undefined) await dialog.getByLabel("Client", { exact: true }).fill(project.client);
  if (project.folder !== undefined) await dialog.getByLabel("Dossier du dépôt").fill(project.folder);
  return dialog;
}

async function createProject(page: Page, project: NewProject) {
  const dialog = await fillNewProject(page, project);
  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.locator('[data-sidebar="sidebar"]').getByRole("button", { name: project.name, exact: true }),
  ).toBeVisible();
}

type CliSprint = { code: string; start: string; end: string };

function cliSprints(home: string, key: string): CliSprint[] {
  const out = execFileSync("bun", [CLI, "sprints", "list", "--project", key, "--json", "--home", home], {
    encoding: "utf8",
  });
  const parsed: unknown = JSON.parse(out);
  if (!Array.isArray(parsed)) throw new Error(`kibo sprints list printed ${out}`);
  return parsed.map((s) => ({ code: text(s, "code"), start: text(s, "start"), end: text(s, "end") }));
}

let repo: E2eRepo | null = null;
test.afterEach(async () => {
  const created = repo;
  repo = null;
  if (created) await expect(() => created.remove()).toPass();
});

test("modifier, workspace, en-tête, réglages et suppression d'un projet", async ({ page }, info) => {
  const key = projectKey("PRJ", info);
  const created = createE2eRepo(key);
  repo = created;
  const name = `Projets ${key}`;
  await page.addInitScript(notificationPermissionDefault);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await createProject(page, { name, key, folder: created.repo });
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const entry = sidebar.getByRole("button", { name, exact: true });

  await entry.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Modifier…" })).toBeVisible();
  await shot(page, info, "ecran-107");
  await page.getByRole("menuitem", { name: "Modifier…" }).click();
  const edit = page.getByRole("dialog", { name: "Modifier le projet" });
  await expect(edit.getByLabel("Dossier", { exact: true })).toHaveValue(created.repo);
  await expect(edit.getByRole("button", { name: "Parcourir…" })).toHaveCount(0);
  await edit.getByLabel("Nom", { exact: true }).fill(`${name} bis`);
  await edit.getByRole("radio", { name: "Couleur #6366F1" }).click();
  await edit
    .getByLabel("Choisir une image…")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(edit.getByRole("img", { name: "Image · Image" })).toBeVisible();
  await shot(page, info, "ecran-107-modifier");
  await edit.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(edit).toBeHidden();
  const renamed = sidebar.getByRole("button", { name: `${name} bis`, exact: true });
  await expect(renamed).toBeVisible();
  const projects = await rpc(page, { method: "listProjects" });
  const saved = (Array.isArray(projects) ? projects : []).find((p) => text(p, "name") === `${name} bis`);
  expect(text(saved, "color")).toBe("#6366F1");
  expect(text(saved, "icon")).not.toBe("");

  await renamed.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Modifier…" }).click();
  await expect(edit.getByRole("group", { name: "Worktrees des agents" })).toHaveCount(0);
  await shot(page, info, "ecran-167");
  await edit.getByRole("button", { name: "Annuler" }).click();
  await expect(edit).toBeHidden();

  await page.goto("/#/settings/workspace");
  await expect(page.getByRole("heading", { level: 1, name: "Workspace" })).toBeVisible();
  await page.getByLabel("Nom", { exact: true }).fill("Maison");
  await page.getByLabel("Description").fill("Mes projets et ceux de l'équipe");
  await page
    .getByLabel("Choisir une image…")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /Maison/ })).toBeVisible();
  await expect(sidebar.getByRole("img", { name: "Image du workspace Maison" })).toHaveAttribute(
    "src",
    /\/icons\/workspace\?v=/,
  );
  await shot(page, info, "ecran-109");

  await page.goto("/#/settings/appearance");
  await expect(page.getByRole("radio", { name: "Système" })).toHaveAttribute("aria-checked", "true");
  await shot(page, info, "ecran-110");
  await page.getByRole("radio", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Clair" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Système" }).click();

  await page.goto("/#/settings/general");
  await expect(page.getByText("Ce réglage vit dans l'application de bureau.")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Ouvrir Kibo à l'ouverture de session" })).toHaveCount(0);
  await page.goto("/#/settings/shortcuts");
  await expect(page.getByRole("heading", { level: 1, name: "Raccourcis" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Navigation" })).toBeVisible();
  await shot(page, info, "ecran-77");

  const header = page.locator("header").first();
  await expect(header.getByRole("button", { name: /Historique des runs/ })).toHaveCount(0);
  await sidebar.getByRole("button", { name: /^Menu de / }).click();
  const menu = page.getByRole("menu", { name: /^Menu de / });
  await menu.getByRole("menuitem", { name: "Thème" }).hover();
  await expect(page.getByRole("menuitemradio", { name: "Système" })).toHaveAttribute("aria-checked", "true");
  await shot(page, info, "ecran-112");
  await expect(menu.getByRole("menuitem", { name: "Sessions" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await sidebar.getByRole("button", { name: /Maison/ }).click();
  await expect(page.getByRole("menuitem", { name: "Paramètres du workspace" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Renommer le workspace…" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/#/");
  await renamed.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Supprimer…" }).click();
  const remove = page.getByRole("dialog", { name: `Supprimer le projet ${name} bis ?` });
  await expect(
    remove.getByText(
      new RegExp(`Le dossier ${escapeRegExp(created.repo)} et ses fichiers ne sont pas touchés`),
    ),
  ).toBeVisible();
  const confirm = remove.getByRole("button", { name: "Supprimer", exact: true });
  await expect(confirm).toBeDisabled();
  await remove.getByLabel(`Tape ${name} bis pour confirmer`).fill(`${name} bis`);
  await shot(page, info, "ecran-108");
  await confirm.click();
  await expect(remove).toBeHidden();
  await expect(renamed).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);
  await expect(
    page.getByRole("tablist", { name: "Onglets" }).getByRole("tab", { name: new RegExp(escapeRegExp(name)) }),
  ).toHaveCount(0);
});

test("créer un projet : cinq pages et six sprints", async ({ page }, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const dialog = await fillNewProject(page, { name: "Centre test", key: "CT", client: "ACME" });
  await dialog.getByLabel("Début du premier sprint").fill("2026-10-19");
  await dialog.getByLabel("Nombre de sprints").fill("6");
  await dialog.getByRole("radio", { name: "1 semaine" }).check();
  await expect(dialog.getByText("6 sprints d'une semaine · du 19 oct. au 27 nov. 2026")).toBeVisible();
  await shot(page, info, "nouveau-projet");
  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(dialog).toBeHidden();

  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const entry = sidebar
    .locator('[data-sidebar="menu-item"]')
    .filter({ has: page.getByRole("button", { name: "Centre test", exact: true }) });
  const pageActions = entry.getByRole("button", { name: /^Actions de la page / });
  await expect(pageActions).toHaveCount(SETUP_PAGES.length);
  const labels = await pageActions.evaluateAll((rows) => rows.map((r) => r.getAttribute("aria-label")));
  expect(labels).toEqual(SETUP_PAGES.map((title) => `Actions de la page ${title}`));

  await entry.getByText("Vue d'ensemble", { exact: true }).click();
  await expect(page.getByText("Pour commencer", { exact: true })).toBeVisible();
  await entry.getByText("Planning", { exact: true }).click();
  for (const code of ["S1", "S2", "S3", "S4", "S5", "S6"])
    await expect(page.getByRole("region", { name: new RegExp(`^${code} `) })).toBeVisible();
  await shot(page, info, "projet-cree");

  const sprints = cliSprints(homeOf(info), "CT");
  expect(sprints).toEqual([
    { code: "S1", start: "2026-10-19", end: "2026-10-23" },
    { code: "S2", start: "2026-10-26", end: "2026-10-30" },
    { code: "S3", start: "2026-11-02", end: "2026-11-06" },
    { code: "S4", start: "2026-11-09", end: "2026-11-13" },
    { code: "S5", start: "2026-11-16", end: "2026-11-20" },
    { code: "S6", start: "2026-11-23", end: "2026-11-27" },
  ]);

  const again = await fillNewProject(page, { name: "Centre bis", key: "CT" });
  await expect(again.getByText("Clé déjà prise")).toBeVisible();
  await expect(again.getByRole("button", { name: "Créer", exact: true })).toBeDisabled();
  await again.getByRole("button", { name: "Annuler" }).click();
  await expect(again).toBeHidden();

  await page.goto("/#/");
  const line = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Centre test" }) });
  await expect(line.getByText("client ACME", { exact: true })).toBeVisible();
});
