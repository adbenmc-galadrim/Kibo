import { expect, type Locator, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { addComponent, createPage, openNewProject, pairAndCreateProject } from "./helpers";
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
  await expect(page.getByText("1 ticket", { exact: true })).toBeVisible();

  await todo.getByRole("button", { name: `Actions ${key}-1` }).click();
  await page.getByRole("menuitem", { name: "Déplacer vers" }).click();
  await page.getByRole("menuitem", { name: "Bloqué…", exact: true }).click();
  await expect(page.getByRole("button", { name: "Bloquer" })).toBeDisabled();
  await page.getByLabel("Motif").fill("Attente du client");
  await page.getByRole("button", { name: "Bloquer" }).click();
  const blocked = page.getByRole("region", { name: "Bloqué" });
  await expect(blocked.getByText(`${key}-1`)).toBeVisible();
  await blocked.scrollIntoViewIfNeeded();

  await page.reload();
  const reloaded = page.getByRole("region", { name: "Bloqué" });
  await reloaded.scrollIntoViewIfNeeded();
  await expect(reloaded.getByText("Attente du client")).toBeVisible();

  const other = `Autre ${key}`;
  await page.getByRole("button", { name: "Aujourd'hui", exact: true }).click();
  await openNewProject(page);
  await page.getByLabel("Nom", { exact: true }).fill(other);
  await page.getByLabel("Clé").fill(`${key}B`);
  await page.getByRole("button", { name: "Créer", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nouveau projet" })).toBeHidden();
  const otherPages = page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: other, exact: true }) })
    .getByRole("list");
  await expect(otherPages.getByRole("button", { name: "Vue d'ensemble", exact: true })).toBeVisible();

  const main = page.getByRole("main");
  await page.getByRole("button", { name: "Aujourd'hui", exact: true }).click();
  await main.getByText(`Kibo ${key}`).click();
  await expect(page.getByRole("region", { name: "À faire" })).toBeVisible();
  await page.getByRole("button", { name: "Aujourd'hui", exact: true }).click();
  await main.getByText(other).click();
  await expect(page.getByText(`Projet créé : ${other}`)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "À faire" })).toHaveCount(0);
});

test("tableau de bord Kanban, sous-ticket et fiche", async ({ page }, info) => {
  const key = projectKey("DASH", info);
  await pairAndCreateProject(page, info, key);
  await createPage(page, "Suivi", "Tableau de bord");
  await addComponent(page, "Kanban");

  const todo = page.getByRole("region", { name: "À faire" });
  await expect(todo).toBeVisible();
  await createTicket(
    page,
    page.getByRole("button", { name: "Nouveau ticket dans À faire", exact: true }),
    "Préparer la démo",
  );
  await expect(todo.getByText(`${key}-1`)).toBeVisible();

  const projectId = decodeURIComponent(/#\/p\/([^/]+)\//.exec(page.url())?.[1] ?? "");
  const snapshot = await rpc(page, { method: "getProject", projectId });
  const parentId = (snapshot as { tickets: { id: string; title: string }[] }).tickets.find(
    (t) => t.title === "Préparer la démo",
  )?.id;
  if (!parentId) throw new Error("parent ticket not found");
  await rpc(page, {
    method: "command",
    projectId,
    command: { method: "createTicket", title: "Enregistrer la vidéo", parentId, statusId: "todo" },
  });

  const chip = "Ouvrir l'ensemble F1 · Préparer la démo";
  await expect(todo.getByRole("article").filter({ hasText: "Préparer la démo" })).toHaveCount(0);
  await expect(page.getByTitle("1 ticket", { exact: true }).first()).toBeAttached();

  await todo.getByRole("article").getByRole("button", { name: chip }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { level: 1, name: "Préparer la démo" })).toBeVisible();
  await expect(sheet).toContainText("Fonctionnalité · F1");
  await expect(sheet.getByText("0 étape livrée sur 1")).toBeVisible();
  await expect(sheet.getByText("Enregistrer la vidéo")).toBeVisible();
});
