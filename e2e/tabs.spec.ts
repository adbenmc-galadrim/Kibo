import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { addComponent, createSidebarPage, pairAndCreateProject, showTabBar } from "./helpers";
import { createRepoProject, projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

let repo: E2eRepo | null = null;
test.afterEach(async () => {
  const created = repo;
  repo = null;
  if (created) await expect(() => created.remove()).toPass();
});

test("onglets épinglés persistés, raccourcis et palette", async ({ page }, info) => {
  const key = projectKey("TAB", info);
  const created = createE2eRepo(key);
  repo = created;
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await createRepoProject(page, `Onglets ${key}`, key, created.repo);
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Kanban");
  await page.getByRole("radio", { name: "Vue", exact: true }).click();
  await page.getByRole("button", { name: "Créer la page" }).click();

  const bar = page.getByRole("tablist", { name: "Onglets" });
  const kanban = bar.getByRole("tab", { name: `Onglets ${key} · Kanban` });
  await showTabBar(page, `Onglets ${key} · Kanban`);
  await expect(kanban).toHaveAttribute("aria-selected", "true");
  await kanban.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Épingler l'onglet/ }).click();
  await expect(bar.getByRole("tab", { name: `Onglets ${key} · Kanban` })).toHaveText("");

  const mine = bar.getByRole("tab", { name: "Mes tickets" });
  await expect
    .poll(async () => JSON.stringify(await rpc(page, { method: "getTabs" })))
    .toContain('"screen":"mine"');
  await page.reload();
  await expect(bar.getByRole("tab", { name: `Onglets ${key} · Kanban` })).toBeVisible();
  await expect(mine).toBeVisible();

  await page.keyboard.press("ControlOrMeta+1");
  await expect(bar.getByRole("tab", { name: "Accueil" })).toHaveAttribute("aria-selected", "true");
  await mine.click();
  await page.keyboard.press("ControlOrMeta+w");
  await expect(mine).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await expect(palette.getByText("Récents")).toBeVisible();
  await palette.getByRole("combobox").fill("kanban");
  await expect(palette.getByRole("option", { name: `Onglets ${key} · Kanban` })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
});

test("onglet fermé : aucun toast, ⌘⇧T, et Backspace ne ferme rien", async ({ page }, info) => {
  const key = projectKey("TBC", info);
  await pairAndCreateProject(page, info, key);
  const bar = page.getByRole("tablist", { name: "Onglets" });

  await showTabBar(page);
  await page.goto("/#/inbox");
  const inbox = bar.getByRole("tab", { name: "Boîte de réception" });
  await expect(inbox).toBeVisible();
  await page.keyboard.press("ControlOrMeta+w");
  await expect(inbox).toHaveCount(0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await shot(page, info, "onglet-ferme");
  await page.keyboard.press("ControlOrMeta+Shift+t");
  await expect(inbox).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

  await createSidebarPage(page, `Kibo ${key}`, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const empty = page.getByText("Les étapes avancent seules avec git et les PR.");
  await expect(empty).toBeVisible();
  const kanbanTab = bar.getByRole("tab", { name: `Kibo ${key} · Kanban` });
  await expect(kanbanTab).toHaveAttribute("aria-selected", "true");
  await empty.click();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await expect(empty).toBeVisible();
  await expect(kanbanTab).toHaveAttribute("aria-selected", "true");
});

test("onglet d'aperçu : navigation, double-clic, modification, rechargement", async ({ page }, info) => {
  const key = projectKey("APR", info);
  await pairAndCreateProject(page, info, key);
  const name = `Kibo ${key}`;
  const bar = page.getByRole("tablist", { name: "Onglets" });
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const previews = bar.locator('[role="tab"][data-preview="true"]');
  const tab = (title: string) => bar.getByRole("tab", { name: title, exact: true });

  await createSidebarPage(page, name, "Brouillon", "Vue");
  await createSidebarPage(page, name, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  await page.getByRole("main").getByRole("button", { name: "Nouveau ticket dans À faire" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau ticket" });
  await dialog.getByLabel("Titre", { exact: true }).fill("Journal");
  await dialog.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(dialog).toBeHidden();
  if (await bar.isVisible()) {
    await tab(`${name} · Kanban`).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Fermer les autres onglets" }).click();
  }
  await showTabBar(page, `${name} · Kanban`);
  await expect(tab(`${name} · Kanban`)).toHaveAttribute("data-preview", "false");

  await sidebar.getByRole("button", { name: "Brouillon", exact: true }).click();
  await expect(tab(`${name} · Brouillon`)).toHaveAttribute("aria-selected", "true");
  await expect(tab(`${name} · Brouillon`)).toHaveAttribute("data-preview", "false");
  await expect(bar.getByRole("tab", { name: new RegExp(`${name} · Kanban`) })).toHaveCount(0);
  await sidebar.getByRole("button", { name: "Kanban", exact: true }).click({ modifiers: ["ControlOrMeta"] });
  await expect(tab(`${name} · Kanban`)).toHaveAttribute("aria-selected", "true");
  await expect(tab(`${name} · Brouillon`)).toBeVisible();
  await bar.getByRole("button", { name: "Fermer Mes tickets", exact: true }).click();
  await expect(tab("Mes tickets")).toHaveCount(0);

  await tab("Accueil").click();
  await sidebar.getByRole("button", { name: /^Boîte de réception/ }).click();
  await expect(previews).toHaveCount(1);
  await expect(previews).toHaveAttribute("aria-label", "Boîte de réception · aperçu");
  await expect(previews.locator("span.italic")).toBeVisible();
  await expect(page.getByText("Chargement…")).toBeHidden();
  await shot(page, info, "ecran-165");
  await previews.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Garder ouvert" })).toBeVisible();
  await shot(page, info, "ecran-165-menu");
  await page.keyboard.press("Escape");
  await previews.dblclick();
  await expect(previews).toHaveCount(0);
  await expect(tab("Boîte de réception")).toHaveAttribute("aria-selected", "true");
  await shot(page, info, "ecran-165b");

  await sidebar.getByRole("button", { name: "Mes tickets", exact: true }).click();
  await expect(tab("Mes tickets")).toHaveAttribute("aria-selected", "true");
  await expect(tab("Boîte de réception")).toHaveCount(0);
  await expect
    .poll(async () => {
      const saved = JSON.stringify(await rpc(page, { method: "getTabs" }));
      return saved.slice(0, saved.indexOf('"recents"'));
    })
    .not.toContain('"screen":"inbox"');
  await page.goBack();
  await expect(tab("Boîte de réception")).toHaveAttribute("aria-selected", "true");

  await tab("Boîte de réception").click({ button: "right" });
  await page.getByRole("menuitem", { name: /Épingler l'onglet/ }).click();
  await sidebar.getByRole("button", { name: "Mes tickets", exact: true }).click();
  await expect(tab("Mes tickets · aperçu")).toHaveAttribute("aria-selected", "true");
  await expect(tab("Boîte de réception")).toBeVisible();

  await bar.getByRole("button", { name: `Fermer ${name} · Kanban`, exact: true }).click();
  await bar.getByRole("button", { name: `Fermer ${name} · Brouillon`, exact: true }).click();
  await tab("Mes tickets · aperçu").click();
  await sidebar.getByRole("button", { name, exact: true }).click();
  await expect(previews).toHaveCount(1);
  await sidebar.getByRole("button", { name: "Kanban", exact: true }).click();
  await expect(tab(`${name} · Kanban · aperçu`)).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("main")
    .getByRole("button", { name: `Actions ${key}-1` })
    .click();
  await page.getByRole("menuitem", { name: "Déplacer vers" }).click();
  await page.getByRole("menuitem", { name: "En cours", exact: true }).click();
  await expect(tab(`${name} · Kanban`)).toHaveAttribute("data-preview", "false");
  await expect(previews).toHaveCount(0);

  await tab("Accueil").click();
  await sidebar.getByRole("button", { name: "Mes tickets", exact: true }).click();
  await expect(previews).toHaveAttribute("aria-label", "Mes tickets · aperçu");
  await expect
    .poll(async () => JSON.stringify(await rpc(page, { method: "getTabs" })))
    .toContain('"screen":"mine"},"pinned":false,"preview":true');
  await page.reload();
  await expect(previews).toHaveAttribute("aria-label", "Mes tickets · aperçu");
  await expect(tab(`${name} · Kanban`)).toHaveAttribute("data-preview", "false");
});
