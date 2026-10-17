import { expect, type Locator, type Page, test } from "@playwright/test";
import { addComponent, createPage, openNewProject, pairAndCreateProject, skipRoleStep } from "./helpers";
import { projectKey } from "./repo-project";

async function createTicket(page: Page, opener: Locator, title: string) {
  await opener.click();
  await page.getByLabel("Titre", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("projet → page → Kanban → ticket, persisté", async ({ page }, info) => {
  const key = projectKey("KIB", info);
  await pairAndCreateProject(page, info, key);
  await createPage(page, "Kanban", "Vue");
  await addComponent(page, "Kanban");

  await createTicket(
    page,
    page.getByRole("button", { name: "Nouveau ticket dans À faire", exact: true }),
    "Écrire le plan",
  );
  const todo = page.getByRole("region", { name: "À faire" });
  await expect(todo.getByText(`${key}-1`)).toBeVisible();
  await expect(page.getByText("1 / 1 · Moi + agents")).toBeVisible();

  await todo.getByRole("button", { name: `Actions ${key}-1` }).click();
  await page.getByRole("menuitem", { name: "Déplacer vers" }).click();
  await page.getByRole("menuitem", { name: "Bloqué…", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bloquer" })).toBeDisabled();
  await page.getByLabel("Motif").fill("Attente du client");
  await page.getByRole("button", { name: "Bloquer" }).click();
  const blocked = page.getByRole("region", { name: "Bloqué" });
  await blocked.scrollIntoViewIfNeeded();
  await expect(blocked.getByText(`${key}-1`)).toBeVisible();

  await page.reload();
  const reloaded = page.getByRole("region", { name: "Bloqué" });
  await reloaded.scrollIntoViewIfNeeded();
  await expect(reloaded.getByText("Attente du client")).toBeVisible();

  const other = `Autre ${key}`;
  await page.getByRole("button", { name: "Accueil" }).click();
  await openNewProject(page);
  await skipRoleStep(page);
  await page.getByLabel("Nom", { exact: true }).fill(other);
  await page.getByLabel("Clé").fill(`${key}B`);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page.getByText("Projet créé")).toBeVisible();

  const main = page.getByRole("main");
  await page.getByRole("button", { name: "Accueil" }).click();
  await main.getByText(`Kibo ${key}`).click();
  await expect(page.getByRole("region", { name: "À faire" })).toBeVisible();
  await page.getByRole("button", { name: "Accueil" }).click();
  await main.getByText(other).click();
  await expect(page.getByText("Projet créé")).toBeVisible();
  await expect(page.getByRole("region", { name: "À faire" })).toHaveCount(0);
});

test("tableau de bord Tickets + Kanban, sous-ticket et fiche", async ({ page }, info) => {
  const key = projectKey("DASH", info);
  await pairAndCreateProject(page, info, key);
  await createPage(page, "Suivi", "Tableau de bord");
  await addComponent(page, "Tickets");
  await addComponent(page, "Kanban");

  const tickets = page.getByRole("region", { name: "Tickets" });
  const todo = page.getByRole("region", { name: "À faire" });
  await expect(tickets).toBeVisible();
  await expect(todo).toBeVisible();
  const left = await tickets.boundingBox();
  const right = await page.getByText("0 / 0 · Moi + agents").boundingBox();
  expect(left && right && left.x + left.width <= right.x).toBe(true);

  await createTicket(
    page,
    tickets.getByRole("button", { name: "Nouveau ticket", exact: true }).first(),
    "Préparer la démo",
  );
  await tickets.getByRole("button", { name: "Déplier Hors fonctionnalité" }).click();
  await expect(tickets.getByText(`${key}-1`)).toBeVisible();

  await tickets.getByRole("button", { name: `Nouveau sous-ticket de ${key}-1` }).click();
  await expect(page.getByRole("dialog").getByText(`${key}-1`)).toBeVisible();
  await page.getByLabel("Titre", { exact: true }).fill("Enregistrer la vidéo");
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(tickets.getByText(`${key}-2`)).toBeVisible();
  const chip = "Ouvrir l'ensemble F1 · Préparer la démo";
  const featureChip = "Ouvrir la fonctionnalité F1 · Préparer la démo";
  await expect(tickets.getByRole("button", { name: featureChip })).toBeVisible();
  await expect(todo.getByRole("article").filter({ hasText: "Préparer la démo" })).toHaveCount(0);
  await expect(page.getByText("1 / 1 · Moi + agents")).toBeVisible();

  await todo.getByRole("article").getByRole("button", { name: chip }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { level: 1, name: "Préparer la démo" })).toBeVisible();
  await expect(sheet).toContainText(`Fonctionnalité · F1 · ${key}-1`);
  await expect(sheet.getByText("0 étape livrée sur 1")).toBeVisible();
  await expect(sheet.getByText("Enregistrer la vidéo")).toBeVisible();
});
