import { rmSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { rpc, type Seeded } from "./agents-seed";
import { addViewPage, askQuestion, capture, openVisibility, type Visibility } from "./visibility-kit";

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

test("le graphe par colonnes cadre la fonctionnalité et allume l'étape en session", async () => {
  const info = test.info();
  const session = (state: "start" | "stop") =>
    rpc(page, {
      method: "setTicketSession",
      projectId: seeded.projectId,
      ticketKey: "KIB-14",
      cwd: null,
      state,
      tool: "T3 Code",
    });
  await session("start");
  const graphPage = await addViewPage(v, "Graphe", "graph@1.0.0");
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(graphPage)}`);
  const lanes = page.getByRole("region", { name: "Fonctionnalités par sprint" });
  const frame = lanes.getByRole("article", { name: /Orchestration des agents$/ });
  await expect(frame).toBeVisible();
  const step = frame.getByRole("listitem").filter({ hasText: "Récepteur de hooks Claude Code" });
  await expect(step).toHaveAttribute("data-session", "true");
  await expect(
    frame.getByRole("listitem").filter({ hasText: "Moteur de règles déclaratif" }),
  ).not.toHaveAttribute("data-session", "true");
  await expect(page.getByRole("button", { name: "Zoom arrière" })).toHaveCount(0);
  await capture(page, info, "188");

  await session("stop");
  await expect(step).not.toHaveAttribute("data-session", "true");
  await expect(frame).toBeVisible();
  await capture(page, info, "188b");
});

test("le filtre « Démarrable » du Kanban garde les tickets démarrables", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  const all = page.getByRole("button", { name: "Tous", exact: true });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  const cards = page.getByRole("article");
  await expect(cards.filter({ hasText: "Démarrable" })).toHaveCount(0);
  await page.getByRole("button", { name: "Démarrable", exact: true }).click();
  await expect(cards.first()).toBeVisible();
  await expect(cards.filter({ hasText: "KIB-21" })).toHaveCount(0);
  await capture(page, info, "188k");
  await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
});
