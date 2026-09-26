import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { e2eHome } from "./e2e-home";
import { addComponent, createPage, createSidebarPage, pairAndCreateProject } from "./helpers";
import { projectKey } from "./repo-project";

test.setTimeout(240_000);

const DRAFT = "hello";
const TITLE = "Hello";

function homeOf(info: TestInfo): string {
  const base = info.project.use.baseURL;
  if (!base) throw new Error(`project ${info.project.name} has no baseURL`);
  return e2eHome(new URL(base).port);
}

async function openComponents(page: Page) {
  await page.getByRole("button", { name: "Composants", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Composants" })).toBeVisible();
}

async function publishDraft(page: Page, version: string, strategy?: "Mettre à jour partout") {
  await rpc(page, { method: "previewPublish", id: DRAFT });
  await openComponents(page);
  const draft = page.getByRole("listitem").filter({ hasText: TITLE });
  await expect(draft.getByText("Tests verts")).toBeVisible();
  await draft.getByRole("button", { name: "Publier" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Publier « ${TITLE} » ${version}`)).toBeVisible({ timeout: 120_000 });
  if (strategy) await dialog.getByRole("radio", { name: new RegExp(strategy) }).check();
  await dialog.getByRole("button", { name: `Publier ${version}` }).click();
}

function bumpDraft(info: TestInfo, version: string, change: string) {
  const file = join(homeOf(info), "components", "src", DRAFT, "kibo.component.json");
  const manifest: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof manifest !== "object" || manifest === null) throw new Error(`invalid manifest ${file}`);
  writeFileSync(file, JSON.stringify({ ...manifest, version, changes: [change] }));
}

test("publier, autoriser, rendre en sandbox, mettre à jour partout", async ({ page }, info) => {
  const key = projectKey("CMP", info);
  await pairAndCreateProject(page, info, key);

  await publishDraft(page, "0.1.0");
  const trust = page.getByRole("dialog", { name: `Autoriser « ${TITLE} » 0.1.0 ?` });
  await expect(trust.getByText("Lire les tickets du projet")).toBeVisible({ timeout: 60_000 });
  await expect(trust.getByText("Aucun accès réseau, aucun fichier local")).toBeVisible();
  await expect(trust.getByRole("radio", { name: /Sandboxé \(recommandé\)/ })).toBeChecked();
  await trust.getByRole("button", { name: "Autoriser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`${TITLE}.*0\\.1\\.0.*Sandboxé`) })).toBeVisible();

  for (const pageTitle of ["Tableau A", "Tableau B"]) {
    await createSidebarPage(page, `Kibo ${key}`, pageTitle, "Tableau de bord");
    await addComponent(page, TITLE);
    const frame = page.frameLocator(`iframe[title="${TITLE}"]`);
    await expect(frame.getByText("Hello")).toBeVisible();
    await expect(frame.getByText("Version 0.1.0")).toBeVisible();
    await expect(page.locator(`iframe[title="${TITLE}"]`)).toHaveAttribute("sandbox", "allow-scripts");
  }

  bumpDraft(info, "0.2.0", "Affiche la version");
  await publishDraft(page, "0.2.0", "Mettre à jour partout");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Utilisé dans 1 projet")).toBeVisible();
  await expect(dialog.getByText("Affiche la version")).toBeVisible();
  await expect(dialog.getByText("Version 0.2.0 publiée.")).toBeVisible({ timeout: 60_000 });
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(`${TITLE}.*0\\.2\\.0.*2 pages · 1 projet`) }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
  await page.getByRole("button", { name: "Tableau A", exact: true }).click();
  await expect(page.frameLocator(`iframe[title="${TITLE}"]`).getByText("Version 0.2.0")).toBeVisible();
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

  writeFileSync(join(homeOf(info), "notes", key, "sans-titre.md"), "# Changé ailleurs\n");
  await expect(page.getByRole("heading", { level: 1, name: "Changé ailleurs" })).toBeVisible({
    timeout: 5_000,
  });
});
