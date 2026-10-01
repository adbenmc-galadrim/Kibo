import { expect, test } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { createRepoProject, projectKey, shot } from "./repo-project";
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
  await createRepoProject(page, name, key, created.repo);
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const entry = sidebar.getByRole("button", { name, exact: true });

  await entry.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Modifier…" })).toBeVisible();
  await shot(page, info, "ecran-107");
  await page.getByRole("menuitem", { name: "Modifier…" }).click();
  const edit = page.getByRole("dialog", { name: "Modifier le projet" });
  await expect(edit.getByLabel("Dossier")).toHaveValue(created.repo);
  await expect(edit.getByRole("button", { name: "Parcourir…" })).toHaveCount(0);
  await edit.getByLabel("Nom").fill(`${name} bis`);
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

  await page.goto("/#/settings/workspace");
  await expect(page.getByRole("heading", { level: 1, name: "Workspace" })).toBeVisible();
  await page.getByLabel("Nom").fill("Maison");
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

  await page.goto("/#/settings/security");
  await expect(page.getByText("Accès web", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Générer un code" })).toBeVisible();
  await page.goto("/#/settings/general");
  await expect(page.getByText("Application")).toHaveCount(0);
  await page.goto("/#/settings/shortcuts");
  await expect(page.getByRole("heading", { level: 1, name: "Raccourcis" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Navigation" })).toBeVisible();
  await shot(page, info, "ecran-77");

  const header = page.locator("header").first();
  await header.getByRole("button", { name: /Historique des runs/ }).click();
  const bell = page.getByRole("menu", { name: "Historique des runs" });
  await expect(bell.getByText("Aucun run pour l'instant.")).toBeVisible();
  await expect(bell.getByRole("button", { name: "Activer les notifications" })).toBeVisible();
  await shot(page, info, "ecran-111");
  await page.keyboard.press("Escape");
  await header.getByRole("button", { name: /^Menu de / }).click();
  const menu = page.getByRole("menu", { name: /^Menu de / });
  await menu.getByRole("menuitem", { name: "Thème" }).hover();
  await expect(page.getByRole("menuitemradio", { name: "Système" })).toHaveAttribute("aria-checked", "true");
  await shot(page, info, "ecran-112");
  await menu.getByRole("menuitem", { name: "Sessions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Sécurité" })).toBeVisible();

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
