import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type TestInfo, test } from "@playwright/test";
import { homeOf } from "./e2e-home";
import { addComponent, createPage, createSidebarPage, pairAndCreateProject } from "./helpers";
import { addPendingComponent, publishDraft } from "./publish-kit";
import { projectKey } from "./repo-project";

test.setTimeout(240_000);

const DRAFT = "hello";
const TITLE = "Hello";

function bumpDraft(info: TestInfo, version: string, change: string) {
  const file = join(homeOf(info), "components", "src", DRAFT, "kibo.component.json");
  const manifest: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof manifest !== "object" || manifest === null) throw new Error(`invalid manifest ${file}`);
  writeFileSync(file, JSON.stringify({ ...manifest, version, changes: [change] }));
}

test("publier, autoriser, rendre en sandbox, mettre à jour partout", async ({ page }, info) => {
  const key = projectKey("CMP", info);
  await pairAndCreateProject(page, info, key);

  await publishDraft(page, DRAFT, "new-version");
  for (const [index, pageTitle] of ["Tableau A", "Tableau B"].entries()) {
    await createSidebarPage(page, `Kibo ${key}`, pageTitle, "Tableau de bord");
    if (index === 0) {
      const trust = await addPendingComponent(page, TITLE, "0.1.0");
      await expect(trust.getByText("Lire les tickets du projet")).toBeVisible();
      await expect(trust.getByText("Aucun accès réseau, aucun fichier local")).toBeVisible();
      await expect(trust.getByRole("radio", { name: /Isolé \(recommandé\)/ })).toBeChecked();
      await trust.getByRole("button", { name: "Autoriser et ajouter" }).click();
      await expect(trust).toBeHidden({ timeout: 60_000 });
    } else await addComponent(page, TITLE);
    const frame = page.frameLocator(`iframe[title="${TITLE}"]`);
    await expect(frame.getByText("Hello")).toBeVisible();
    await expect(frame.getByText("Version 0.1.0")).toBeVisible();
    await expect(page.locator(`iframe[title="${TITLE}"]`)).toHaveAttribute("sandbox", "allow-scripts");
    await expect(page.locator(`iframe[title="${TITLE}"]`)).toHaveAttribute(
      "allow",
      "autoplay 'none'; gamepad 'none'; fullscreen 'none'; camera 'none'; microphone 'none'; geolocation 'none'",
    );
    await expect(page.getByRole("button", { name: "Plein écran" })).toHaveCount(0);
  }

  bumpDraft(info, "0.2.0", "Affiche la version");
  await publishDraft(page, DRAFT, "update-all");
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await sidebar.getByRole("button", { name: "Tableau A", exact: true }).click();
  await expect(page.frameLocator(`iframe[title="${TITLE}"]`).getByText("Version 0.2.0")).toBeVisible({
    timeout: 60_000,
  });
});

test("graphe et notes intégrés", async ({ page }, info) => {
  const key = projectKey("GRN", info);
  await pairAndCreateProject(page, info, key);
  await createPage(page, "Graphe", "Vue");
  await addComponent(page, "Graphe de dépendances");
  await expect(page.getByText("Aucune dépendance entre les tickets affichés.")).toBeVisible();

  await createSidebarPage(page, `Kibo ${key}`, "Notes", "Vue");
  await addComponent(page, "Notes");
  await expect(page.getByText("Aucune note dans ce dossier.")).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle note" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle note" });
  await dialog.getByLabel("Titre").fill("Décisions");
  await expect(dialog.getByText("Fichier : decisions.md")).toBeVisible();
  await dialog.getByRole("button", { name: "Créer" }).click();
  await expect(dialog).toBeHidden();
  const editor = page.getByRole("textbox", { name: "Contenu de la note" });
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type(`# Décisions\n\nVoir ${key}-1.`);
  await expect(page.getByText("Enregistré • local")).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Aperçu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Décisions" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("list", { name: "Notes" }).getByText("Décisions")).toBeVisible();

  const notesDir = join(homeOf(info), "notes", key);
  expect(existsSync(join(notesDir, "sans-titre.md"))).toBe(false);
  expect(existsSync(join(notesDir, "decisions.md"))).toBe(true);
  writeFileSync(join(notesDir, "decisions.md"), "# Changé ailleurs\n");
  await expect(page.getByRole("heading", { level: 1, name: "Changé ailleurs" })).toBeVisible({
    timeout: 5_000,
  });
});
