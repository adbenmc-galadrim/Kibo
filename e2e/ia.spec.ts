import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { createPage, skipRoleStep } from "./helpers";
import { E2E_TOKEN } from "./token";

const suffix = (info: TestInfo) => (info.project.name.endsWith("light") ? "L" : "D");

async function pair(page: Page, info: TestInfo) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const html = page.locator("html");
  if (info.project.name.endsWith("dark")) await expect(html).toHaveClass(/dark/);
  else await expect(html).not.toHaveClass(/dark/);
}

async function openNewProject(page: Page) {
  await page.getByRole("button", { name: "Nouveau projet" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function fillProject(page: Page, name: string, key: string) {
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Clé").fill(key);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

function projectPages(page: Page, name: string) {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name, exact: true }) })
    .getByRole("list");
}

async function finishProject(page: Page, name: string, key: string) {
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.getByRole("radio", { name: /Pages conseillées/ })).toHaveAttribute(
    "data-state",
    "checked",
  );
  await fillProject(page, name, key);
}

test("Ton rôle : preset Designer, une page décochée", async ({ page }, info) => {
  const s = suffix(info);
  await pair(page, info);
  await openNewProject(page);
  await page.getByRole("radio", { name: /Designer/ }).click();
  await page.getByLabel("Inclure Kanban").click();
  await finishProject(page, `Design ${s}`, `DSG${s}`);
  const pages = projectPages(page, `Design ${s}`);
  await expect(pages.getByRole("button", { name: "Tableau de bord" })).toBeVisible();
  await expect(pages.getByRole("button", { name: "Notes" })).toBeVisible();
  await expect(pages.getByRole("button", { name: "Kanban" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Tickets" }).getByText("Mes tickets · 0 sur 0"),
  ).toBeVisible();
});

test("Ton rôle : suggestion de Claude (faux claude)", async ({ page }, info) => {
  const s = suffix(info);
  await pair(page, info);
  await openNewProject(page);
  await page.getByRole("radio", { name: /Autre/ }).click();
  await page.getByLabel("Décris ton usage en une phrase").fill("Je suis freelance et je suis trois clients");
  await page.getByRole("button", { name: "Proposer avec Claude" }).click();
  await expect(page.getByText("Proposition de Claude")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Nom de la page 1")).toHaveValue("Suivi clients");
  await finishProject(page, `Freelance ${s}`, `FRL${s}`);
  const pages = projectPages(page, `Freelance ${s}`);
  await expect(pages.getByRole("button", { name: "Suivi clients" })).toBeVisible();
  await expect(pages.getByRole("button", { name: "Tickets" })).toBeVisible();
});

test("Créer un composant avec un agent, jusqu'au rendu sandboxé", async ({ page }, info) => {
  test.setTimeout(180_000);
  const s = suffix(info);
  await pair(page, info);
  await openNewProject(page);
  await skipRoleStep(page);
  await fillProject(page, `Composants ${s}`, `CMP${s}`);
  await createPage(page, "Tableau de bord", "Tableau de bord");

  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("button", { name: /Créer un composant/ }).click();
  await page
    .getByLabel("Ce que doit faire le composant")
    .fill("Burndown du sprint : tickets restants par jour, ligne idéale.");
  await page.getByLabel("Titre").fill(`Burndown ${s}`);
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
  await expect(trust.getByRole("radio", { name: /Sandboxé \(recommandé\)/ })).toBeChecked();
  await trust.getByRole("button", { name: "Autoriser et ajouter" }).click();
  await expect(trust).toBeHidden({ timeout: 60_000 });

  const frame = page.frameLocator("iframe[sandbox='allow-scripts']");
  await expect(frame.getByText("tickets restants")).toBeVisible({ timeout: 30_000 });
});
