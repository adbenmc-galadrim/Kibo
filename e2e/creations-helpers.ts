import { expect as baseExpect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createPage, pairAndCreateProject } from "./helpers";
import { projectKey } from "./repo-project";

export const expect = baseExpect.configure({ timeout: 60_000 });

export async function pairOnDashboard(page: Page, info: TestInfo) {
  await pairAndCreateProject(page, info, projectKey("CRE", info));
  await createPage(page, "Tableau de bord", "Tableau de bord");
}

export const createDialog = (page: Page): Locator => page.getByRole("dialog", { name: "Créer un composant" });

export async function openCreateDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("button", { name: /Créer un composant/ }).click();
  const dialog = createDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function describeComponent(dialog: Locator, title: string, description: string) {
  await dialog.getByLabel("Ce que doit faire le composant").fill(description);
  await dialog.getByLabel("Titre", { exact: true }).fill(title);
}

export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  return box;
}
