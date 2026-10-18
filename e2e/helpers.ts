import { expect, type Page, type TestInfo } from "@playwright/test";
import { E2E_TOKEN } from "./token";

export async function skipRoleStep(page: Page) {
  await expect(page.getByRole("dialog", { name: "Nouveau projet" })).toBeVisible();
}

export async function openNewProject(page: Page) {
  await page.getByRole("button", { name: "Ajouter un projet" }).click();
  await page.getByRole("menuitem", { name: "Nouveau projet" }).click();
}

export async function openWorkspaceMenuItem(page: Page, item: "Composants" | "Changements") {
  await page.locator('[data-sidebar="sidebar"]').getByRole("button").first().click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

export async function openChangesInNewTab(page: Page, project: string) {
  await page.getByRole("button", { name: "Nouvel onglet" }).click();
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await palette.getByRole("combobox").fill("changements");
  await palette.getByRole("option", { name: `Voir les changements de ${project}` }).click();
}

export async function openNewTicketFromPalette(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await palette.getByRole("combobox").fill("nouveau ticket");
  await palette.getByRole("option", { name: "Nouveau ticket", exact: true }).click();
}

export async function showTabBar(page: Page, back?: string) {
  const bar = page.getByRole("tablist", { name: "Onglets" });
  await expect(bar).toBeHidden();
  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("button", { name: "Mes tickets", exact: true })
    .click({ modifiers: ["ControlOrMeta"] });
  await expect(bar.getByRole("tab", { name: "Mes tickets" })).toBeVisible();
  const tabs = bar.getByRole("tab");
  const original =
    back === undefined ? tabs.nth((await tabs.count()) - 2) : bar.getByRole("tab", { name: back });
  await original.click();
}

export async function pairAndCreateProject(page: Page, info: TestInfo, key: string) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const html = page.locator("html");
  if (info.project.name.endsWith("dark")) await expect(html).toHaveClass(/dark/);
  else await expect(html).not.toHaveClass(/dark/);

  await openNewProject(page);
  await skipRoleStep(page);
  await page.getByLabel("Nom", { exact: true }).fill(`Kibo ${key}`);
  await page.getByLabel("Clé").fill(key);
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByText("Projet créé")).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
}

type PageKind = "Tableau de bord" | "Vue";

async function fillNewPage(page: Page, title: string, kind: PageKind) {
  const dialog = page.getByRole("dialog", { name: "Nouvelle page" });
  await dialog.getByLabel("Nom", { exact: true }).fill(title);
  await dialog.getByRole("radio", { name: kind, exact: true }).click();
  await dialog.getByRole("button", { name: "Créer la page" }).click();
}

export async function createPage(page: Page, title: string, kind: PageKind) {
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await fillNewPage(page, title, kind);
}

export async function createSidebarPage(page: Page, project: string, title: string, kind: PageKind) {
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const button = page.getByRole("button", { name: project, exact: true });
  await sidebar.locator(button).click();
  await sidebar
    .getByRole("listitem")
    .filter({ has: button })
    .getByRole("button", { name: "Nouvelle page" })
    .click();
  await fillNewPage(page, title, kind);
}

export async function addComponent(page: Page, title: string, closeTimeout?: number) {
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("radio", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Ajouter à la page" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: closeTimeout });
}
