import { rmSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { createGitRepo, rpc, type Seeded, seedWorkspace, text } from "./agents-seed";
import { addComponent, createSidebarPage } from "./helpers";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

let repo: string | null = null;
let graph: { seeded: Seeded; pageId: string } | null = null;
test.afterAll(async () => {
  const dir = repo;
  repo = null;
  if (dir) await expect(() => rmSync(dir, { recursive: true, force: true })).toPass();
});

async function seedGraph(page: Page): Promise<{ seeded: Seeded; pageId: string }> {
  repo = createGitRepo();
  const seeded = await seedWorkspace(page, repo);
  const command = (cmd: Record<string, unknown>) =>
    rpc(page, { method: "command", projectId: seeded.projectId, command: cmd });
  const pageId = text(await command({ method: "addPage", title: "Graphe", kind: "view" }), "id");
  await command({ method: "addInstance", pageId, component: "graph@1.0.0" });
  return { seeded, pageId };
}

async function openGraph(page: Page) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Aujourd'hui" })).toBeVisible();
  graph ??= await seedGraph(page);
  await page.goto(`/#/p/${graph.seeded.projectId}/${encodeURIComponent(graph.pageId)}`);
  const lanes = page.getByRole("region", { name: "Fonctionnalités par sprint" });
  await expect(lanes).toBeVisible();
  return lanes;
}

const views = (page: Page) => page.getByRole("main").getByRole("radiogroup", { name: "Vue" });

test("sans sprint : une seule colonne « À planifier » et la barre « Vue »", async ({ page }, info) => {
  const lanes = await openGraph(page);
  await expect(lanes.getByRole("group")).toHaveCount(1);
  const reserve = lanes.getByRole("group", { name: "À planifier" });
  await expect(reserve).toBeVisible();
  for (const title of ["Noyau de données", "Orchestration des agents", "UI de base"])
    await expect(lanes.getByRole("article", { name: new RegExp(`${title}$`) })).toBeVisible();
  await expect(views(page).getByRole("radio")).toHaveText(["Fonctionnalités", "PRs"]);
  await expect(views(page).getByRole("radio", { name: "Fonctionnalités" })).toBeChecked();
  for (const name of ["Options", "Livrées repliées"])
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  await shot(page, info, "graphe-sans-sprint");

  await lanes.getByRole("button", { name: "Récepteur de hooks Claude Code" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("la vue choisie est retenue après rechargement", async ({ page }) => {
  const lanes = await openGraph(page);
  await views(page).getByRole("radio", { name: "PRs" }).click();
  await expect(lanes).toBeHidden();
  await page.reload();
  await expect(views(page).getByRole("radio", { name: "PRs" })).toBeChecked();
  await expect(page.getByRole("region", { name: "Fonctionnalités par sprint" })).toHaveCount(0);
  await views(page).getByRole("radio", { name: "Fonctionnalités" }).click();
  await expect(page.getByRole("region", { name: "Fonctionnalités par sprint" })).toBeVisible();
});

async function setFormat(page: Page, format: RegExp) {
  await page.getByRole("button", { name: "Modifier la disposition" }).click();
  await page.getByRole("button", { name: "Format de Graphe de dépendances" }).click();
  await page.getByRole("menuitemradio", { name: format }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("button", { name: "Modifier la disposition" })).toBeVisible();
}

test("widget : un contenu par format", async ({ page }, info) => {
  await openGraph(page);
  await createSidebarPage(page, "Kibo", "Suivi des dépendances", "Tableau de bord");
  await addComponent(page, "Graphe de dépendances");
  const widget = page.locator("[data-instance]").filter({ has: page.getByText("Graphe de dépendances") });

  const waiting = widget.getByRole("list", { name: "En attente" });
  await expect(waiting.getByRole("listitem").first()).toHaveText(/^KIB-\d+ · attend KIB-\d+/);
  await expect(widget.getByRole("list", { name: "Chemin critique" })).toBeVisible();
  await expect(widget.getByRole("radiogroup", { name: "Vue" })).toHaveCount(0);
  await shot(page, info, "graphe-widget-moyen");
  await waiting.getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await setFormat(page, /Large · 6 × 6/);
  const region = widget.getByRole("region", { name: "Fonctionnalités par sprint" });
  await expect(region).toBeVisible();
  await expect(region.getByRole("group", { name: "À planifier" })).toBeVisible();
  await expect(widget.getByRole("radiogroup", { name: "Vue" })).toBeVisible();
  await shot(page, info, "graphe-widget-large");

  await setFormat(page, /Demi-page · 12 × 6/);
  await expect(widget.getByRole("region", { name: "Fonctionnalités par sprint" })).toBeVisible();
  await shot(page, info, "graphe-widget-demi-page");

  await setFormat(page, /Petit · 3 × 3/);
  for (const name of ["Bloqués", "Prêts", "Chemin critique"])
    await expect(widget.getByRole("group", { name })).toContainText(/\d/);
  await shot(page, info, "graphe-widget-petit");
});
