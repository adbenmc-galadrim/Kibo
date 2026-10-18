import { rmSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import type { Seeded } from "./agents-seed";
import {
  addViewPage,
  askQuestion,
  capture,
  labelChapters,
  openVisibility,
  type Visibility,
} from "./visibility-kit";

test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

let v: Visibility;
let page: Page;
let seeded: Seeded;

test.beforeAll(async ({ browser }, info) => {
  v = await openVisibility(browser, info);
  page = v.page;
  seeded = v.seeded;
});

test.afterAll(async () => {
  await page?.context().close();
  const dir = v?.repo;
  if (dir) await expect(() => rmSync(dir, { recursive: true, force: true })).toPass();
});

test("la page Questions filtre par destinataire, exporte et enregistre une réponse collée", async () => {
  const info = test.info();
  await askQuestion(v, 15, "Garder le glisser-déposer au clavier ?", null);
  await askQuestion(v, 22, "Exporter les pièces jointes ?", "client");
  await askQuestion(v, 18, "Importer les issues fermées ?", "client");
  await askQuestion(v, 29, "Migrer les anciens liens ?", "product");
  const questionsPage = await addViewPage(v, "Questions", "questions@1.0.0");
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(questionsPage)}`);
  await expect(page.getByRole("radio", { name: "Tous (4)" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Client (2)" })).toBeVisible();
  await capture(page, info, "187");

  await page.getByRole("radio", { name: "Client (2)" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  const card = page.getByRole("article", { name: "Exporter les pièces jointes ?" });
  await card.getByRole("button", { name: "Exporter" }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^Questions pour Client · /);
  expect(copied).toMatch(/Q\d+ · Exporter les pièces jointes \?/);
  await expect(page.getByText("1 question marquée envoyée")).toBeVisible();
  await expect(card.getByText(/^envoyée le /)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Exporter pour le client (2)" }).click();
  const all = await page.evaluate(() => navigator.clipboard.readText());
  expect(all).toContain("Importer les issues fermées ?");
  await expect(page.getByText("2 questions marquées envoyées")).toBeVisible();
  await page.keyboard.press("Escape");
  await capture(page, info, "187b");

  await card.getByRole("button", { name: "Coller la réponse" }).click();
  const form = page.getByRole("form", { name: "Coller la réponse à Exporter les pièces jointes ?" });
  await form.getByLabel("Réponse reçue").fill("Oui, en lien seulement.");
  await capture(page, info, "187c");
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("radiogroup", { name: "État" }).getByRole("radio", { name: "Répondues" }).click();
  await expect(page.getByText("Réponse : Oui, en lien seulement.")).toBeVisible();

  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("button", { name: "Kibo", exact: true })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Modifier…" }).click();
  const dialog = page.getByRole("dialog", { name: "Modifier le projet" });
  await expect(dialog.getByText("Destinataires des questions")).toBeVisible();
  await dialog
    .getByText("Destinataires des questions")
    .evaluate((el) => el.scrollIntoView({ block: "start" }));
  await capture(page, info, "187d");
  await page.keyboard.press("Escape");
});

test("le graphe cadre les ensembles, focus, zoom éloigné et cadres par étiquette", async () => {
  const info = test.info();
  await labelChapters(v, [
    [7, "c1"],
    [9, "c1"],
    [11, "c1"],
    [14, "c1"],
    [15, "c2"],
    [21, "c2"],
    [22, "c2"],
  ]);
  const graphPage = await addViewPage(v, "Graphe", "graph@1.0.0");
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(graphPage)}`);
  const canvas = page.getByRole("region", { name: "Graphe des dépendances" });
  await expect(canvas.locator("[data-frame]").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^Afficher les terminés \(\d+\)$/ })).toBeVisible();
  await expect(canvas.getByRole("button", { name: /^KIB-13 / })).toHaveCount(0);
  await capture(page, info, "188");

  await canvas.getByRole("button", { name: /^KIB-21 / }).click();
  await expect(page.getByText(/^Focus : KIB-21 · /)).toBeVisible();
  await expect(canvas.getByRole("button", { name: /^KIB-9 / })).toHaveAttribute("data-focus", "out");
  await capture(page, info, "188b");
  await page.keyboard.press("Escape");
  await expect(page.getByText(/^Focus : KIB-21 · /)).toHaveCount(0);

  for (let i = 0; i < 5; i += 1) await page.getByRole("button", { name: "Zoom arrière" }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-zoom"))).toBeLessThan(0.6);
  await capture(page, info, "188c");
  await page.getByRole("button", { name: "Taille réelle" }).click();

  await page.getByRole("button", { name: "Affichage" }).click();
  await page.getByRole("menuitem", { name: "Regrouper par étiquette" }).click();
  await page.getByRole("menuitemradio", { name: "chapitre:" }).click();
  await expect(canvas.getByRole("button", { name: "Replier c1" })).toBeVisible();
  await canvas.getByRole("button", { name: "Replier c2" }).click();
  await expect(canvas.getByRole("button", { name: "Déplier c2" })).toBeVisible();
  await capture(page, info, "188d");
});

test("le Kanban signale les tickets démarrables", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await expect(page.getByRole("radio", { name: "Tous", exact: true })).toBeChecked();
  const cards = page.getByRole("article");
  await expect(cards.filter({ hasText: "Démarrable" }).first()).toBeVisible();
  await expect(cards.filter({ hasText: "KIB-21" }).filter({ hasText: "Démarrable" })).toHaveCount(0);
  await capture(page, info, "188k");
});
