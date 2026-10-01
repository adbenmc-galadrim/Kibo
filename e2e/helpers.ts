import { expect, type Page, type TestInfo } from "@playwright/test";
import { E2E_TOKEN } from "./token";

export async function skipRoleStep(page: Page) {
  await page.getByRole("button", { name: "Passer" }).click();
}

export async function pairAndCreateProject(page: Page, info: TestInfo, key: string) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const html = page.locator("html");
  if (info.project.name.endsWith("dark")) await expect(html).toHaveClass(/dark/);
  else await expect(html).not.toHaveClass(/dark/);

  await page.getByRole("button", { name: "Nouveau projet" }).first().click();
  await skipRoleStep(page);
  await page.getByLabel("Nom", { exact: true }).fill(`Kibo ${key}`);
  await page.getByLabel("Clé").fill(key);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page.getByText("Projet créé")).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
}

type PageKind = "Tableau de bord" | "Vue";

async function fillNewPage(page: Page, title: string, kind: PageKind) {
  await page.getByLabel("Nom", { exact: true }).fill(title);
  await page.getByRole("radio", { name: kind, exact: true }).click();
  await page.getByRole("button", { name: "Créer la page" }).click();
}

export async function createPage(page: Page, title: string, kind: PageKind) {
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await fillNewPage(page, title, kind);
}

export async function createSidebarPage(page: Page, project: string, title: string, kind: PageKind) {
  const button = page.getByRole("button", { name: project, exact: true });
  await button.click();
  await page
    .getByRole("listitem")
    .filter({ has: button })
    .getByRole("button", { name: "Nouvelle page" })
    .click();
  await fillNewPage(page, title, kind);
}

export async function addComponent(page: Page, title: string) {
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("radio", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Ajouter à la page" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}
