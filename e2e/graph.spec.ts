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
  await expect(page.getByRole("button", { name: "Vue d'ensemble" })).toBeVisible();
  graph ??= await seedGraph(page);
  await page.goto(`/#/p/${graph.seeded.projectId}/${encodeURIComponent(graph.pageId)}`);
  const canvas = page.getByRole("region", { name: "Graphe des dépendances" });
  await expect(canvas).toBeVisible();
  return canvas;
}

const transformOf = (page: Page) =>
  page.locator("[data-stage]").evaluate((el) => (el instanceof HTMLElement ? el.style.transform : ""));

test("trackpad : pincement, déplacement, Tout voir, double clic, minimap", async ({ page }, info) => {
  const canvas = await openGraph(page);
  await expect(canvas.getByRole("button", { name: /KIB-21 / })).toBeVisible();
  const initial = await canvas.getAttribute("data-zoom");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -60);
  await page.keyboard.up("Control");
  await expect.poll(() => canvas.getAttribute("data-zoom")).not.toBe(initial);

  const before = await transformOf(page);
  await page.mouse.wheel(40, 30);
  await expect.poll(() => transformOf(page)).not.toBe(before);

  await page.getByRole("button", { name: "Tout voir" }).click();
  await expect.poll(() => canvas.getAttribute("data-zoom")).toBe(initial);
  await shot(page, info, "graphe-tout-voir");

  await canvas.getByRole("button", { name: /KIB-21 / }).dblclick();
  await expect(canvas).toHaveAttribute("data-zoom", "1.25");

  const minimap = page.getByRole("img", { name: "Vue d'ensemble du graphe" });
  await expect(minimap).toBeVisible();
  const framed = await transformOf(page);
  await minimap.click({ position: { x: 4, y: 4 } });
  await expect.poll(() => transformOf(page)).not.toBe(framed);
  await shot(page, info, "graphe-navigation");
});

test("sélection : clic, Ouvrir, flèches, Entrée, boîte avec Shift", async ({ page }, info) => {
  await openGraph(page);
  const canvas = page.getByRole("region", { name: "Graphe des dépendances" });
  const node = canvas.getByRole("button", { name: /KIB-11 / });
  await node.click();
  await expect(node).toHaveAttribute("data-selected", "true");
  await shot(page, info, "graphe-selection");
  await canvas.getByRole("button", { name: "Ouvrir KIB-11" }).click();
  await expect(page.getByRole("dialog").getByText("KIB-11")).toBeVisible();
  await page.keyboard.press("Escape");
  await node.click();
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await expect(canvas.locator("[data-selected='true']")).toHaveCount(1);
  await expect(canvas.locator("[data-selected='true']")).not.toHaveText(/KIB-11/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("no canvas box");
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 8, box.y + box.height - 60, { steps: 8 });
  await shot(page, info, "graphe-boite-selection");
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect.poll(() => canvas.locator("[data-selected='true']").count()).toBeGreaterThan(2);
  await shot(page, info, "graphe-selection-multiple");
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
  await shot(page, info, "graphe-widget-moyen");
  await waiting.getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await setFormat(page, /Large · 6 × 6/);
  await expect(widget.getByRole("region", { name: "Graphe des dépendances" })).toBeVisible();
  await expect(widget.getByRole("button", { name: "Tout voir" })).toBeVisible();
  await expect(widget.getByRole("img", { name: "Vue d'ensemble du graphe" })).toHaveCount(0);
  await shot(page, info, "graphe-widget-large");

  await setFormat(page, /Demi-page · 12 × 6/);
  await expect(widget.getByRole("region", { name: "Graphe des dépendances" })).toBeVisible();
  await shot(page, info, "graphe-widget-demi-page");

  await setFormat(page, /Petit · 3 × 3/);
  for (const name of ["Bloqués", "Prêts", "Chemin critique"])
    await expect(widget.getByRole("group", { name })).toContainText(/\d/);
  await shot(page, info, "graphe-widget-petit");
});
