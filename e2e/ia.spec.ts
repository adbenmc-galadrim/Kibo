import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { createPage, openNewProject as openNewProjectMenu } from "./helpers";
import { E2E_TOKEN } from "./token";

const suffix = (info: TestInfo) => (info.project.name.endsWith("light") ? "L" : "D");

async function pair(page: Page, info: TestInfo) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const html = page.locator("html");
  if (info.project.name.endsWith("dark")) await expect(html).toHaveClass(/dark/);
  else await expect(html).not.toHaveClass(/dark/);
}

async function openNewProject(page: Page) {
  await openNewProjectMenu(page);
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function fillProject(page: Page, name: string, key: string) {
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Clé").fill(key);
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("Créer un composant avec un agent, jusqu'au rendu sandboxé", async ({ page }, info) => {
  test.setTimeout(180_000);
  const s = suffix(info);
  await pair(page, info);
  await openNewProject(page);
  await fillProject(page, `Composants ${s}`, `CMP${s}`);
  await createPage(page, "Tableau de bord", "Tableau de bord");

  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("button", { name: /Créer un composant/ }).click();
  await page
    .getByLabel("Ce que doit faire le composant")
    .fill("Burndown du sprint : tickets restants par jour, ligne idéale.");
  await page.getByLabel("Titre", { exact: true }).fill(`Burndown ${s}`);
  await expect(page.getByLabel("Identifiant")).toHaveValue(`burndown-${s.toLowerCase()}`);
  await page.getByRole("button", { name: "Générer avec un agent" }).click();

  const files = page.getByRole("list", { name: "Relire le diff" });
  await expect(files).toBeVisible({ timeout: 120_000 });
  await expect(files.getByRole("button", { name: /ui\.tsx/ })).toBeVisible();
  await page.getByRole("button", { name: "J'ai relu, continuer" }).click();

  const trust = page.getByRole("dialog", { name: new RegExp(`Autoriser « Burndown ${s} » 0\\.1\\.0 \\?`) });
  await expect(trust.getByText(/Composant généré par IA/)).toBeVisible();
  const create = page.getByRole("dialog", { name: "Créer un composant" });
  await expect(create).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Ajouter un composant" })).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(trust).toBeHidden();
  await expect(create).toBeVisible();
  await expect(create.getByRole("list", { name: "Relire le diff" })).toBeVisible();
  await create.getByRole("button", { name: "J'ai relu, continuer" }).click();
  await expect(trust).toBeVisible();
  await expect(create).toBeHidden();
  await expect(trust.getByRole("radio", { name: /Isolé \(recommandé\)/ })).toBeChecked();
  await trust.getByRole("button", { name: "Autoriser et ajouter" }).click();
  await expect(trust).toBeHidden({ timeout: 60_000 });

  const frame = page.frameLocator("iframe[sandbox='allow-scripts']");
  await expect(frame.getByText("tickets restants")).toBeVisible({ timeout: 30_000 });
});
