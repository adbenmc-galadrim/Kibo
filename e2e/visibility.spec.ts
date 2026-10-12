import { rmSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { runState, type Seeded } from "./agents-seed";
import {
  addViewPage,
  askQuestion,
  assignOpus,
  capture,
  labelChapters,
  openVisibility,
  releaseHold,
  ticketOf,
  type Visibility,
  WIDE,
} from "./visibility-kit";

test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

let v: Visibility;
let page: Page;
let seeded: Seeded;
let held = "";

const bar = () => page.getByRole("button", { name: /^(Déplier|Replier) les agents$/ });
const EDGE = { x: 4, y: 4 };
const dock = () => page.getByRole("region", { name: "Agents" });

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

test("la barre et le volet suivent un run de ticket, son fil et son plan", async () => {
  const info = test.info();
  held = await assignOpus(v, 14);
  await expect.poll(() => runState(page, "KIB-14"), { timeout: 30_000 }).toBe("running");
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await expect(page.getByText("1/3 place")).toBeVisible();
  await expect(page.getByText("KIB-14 · 2/5 · Corriger la validation")).toBeVisible();
  await capture(page, info, "183");

  await bar().press("Enter");
  await expect(page.getByRole("button", { name: "Replier les agents" })).toBeVisible();
  await bar().press(" ");
  await expect(page.getByRole("button", { name: "Déplier les agents" })).toBeVisible();
  await bar().click({ position: EDGE });
  const runs = dock().getByRole("region", { name: "Runs" });
  await runs.getByRole("button", { name: /KIB-14/ }).click();
  const feed = dock().getByRole("region", { name: "Fil" });
  await expect(feed.getByText("Je lis le formulaire.")).toBeVisible();
  await expect(
    dock().getByRole("region", { name: "Plan" }).getByText("Corriger la validation"),
  ).toBeVisible();

  const handle = page.getByRole("separator", { name: "Redimensionner le volet des agents" });
  const before = await dock().boundingBox();
  const grip = await handle.boundingBox();
  if (!before || !grip) throw new Error("dock not laid out");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 - 120, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await dock().boundingBox())?.height ?? 0)
    .toBeGreaterThan(before.height + 100);
  const stored = await page.evaluate(() => sessionStorage.getItem("kibo.agents.dock.height"));
  expect(Number(stored)).toBeGreaterThan(0);
  await handle.dblclick();
  await expect(handle).toHaveAttribute("aria-valuenow", String(Math.round(WIDE.height * 0.45)));
  expect(await page.evaluate(() => sessionStorage.getItem("kibo.agents.dock.height"))).toBeNull();
  const overflow = await feed.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await capture(page, info, "184");
});

test("une mention du Kanban ouvre la carte, le volet du run puis sa page", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  if ((await page.getByRole("button", { name: "Replier les agents" }).count()) > 0)
    await bar().click({ position: EDGE });
  const card = page.getByRole("article").filter({ hasText: "KIB-14" });
  const mention = card.getByRole("button", { name: "global · livraison-opus · KIB-14" });
  await mention.hover();
  const peek = page.locator("[data-slot=hover-card-content]");
  await expect(peek.getByText("2/5 · Corriger la validation")).toBeVisible();
  await expect(peek.getByText("KIB-14 · Récepteur de hooks Claude Code")).toBeVisible();
  await expect(peek.getByRole("button", { name: "Voir l'historique" })).toBeVisible();
  await capture(page, info, "186");

  await mention.click();
  const panel = page.getByRole("dialog", { name: "Run global · livraison-opus · KIB-14" });
  await expect(
    panel.getByRole("region", { name: "Fil narratif" }).getByText("Je lis le formulaire."),
  ).toBeVisible();
  await expect(panel.getByText("Le message d'erreur doit rester")).toHaveCount(0);
  await capture(page, info, "186b");

  await panel.getByRole("button", { name: "Ouvrir en grand" }).click();
  await expect(page).toHaveURL(new RegExp(`#/runs/${held}$`));
  await expect(panel).toBeHidden();
  const feed = page.getByRole("region", { name: "Fil narratif" });
  await expect(feed.getByText("Je lis le formulaire.")).toBeVisible();
  await expect(feed.getByText("Le message d'erreur doit rester")).toHaveCount(0);
  await page.getByText("Afficher le raisonnement").click();
  await expect(feed.getByText("Le message d'erreur doit rester en français")).toBeVisible();
  await capture(page, info, "186c");
});

test("à la fin du run, le volet résume le compte rendu et la fiche le montre dans Activité", async () => {
  const info = test.info();
  await releaseHold(v, info, held);
  await expect.poll(() => runState(page, "KIB-14"), { timeout: 30_000 }).toBe("done");
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await bar().click({ position: EDGE });
  const recent = dock().getByRole("list", { name: /^Terminés depuis 24 h · \d+$/ });
  await expect(recent).toContainText("KIB-14 · fait, 2 points à vérifier, 1 fichier non mentionné");
  await recent.getByRole("button", { name: /KIB-14/ }).click();
  const feed = dock().getByRole("region", { name: "Fil" });
  const failed = feed
    .locator("[data-failed=true]")
    .filter({ hasText: "lancé les tests (12 réussis, 1 échec)" });
  await failed.getByRole("button").click();
  await expect(failed.getByText("LoginForm.tsx")).toBeVisible();
  await expect(feed.getByText("‹masqué›")).toBeVisible();
  await expect(feed).not.toContainText("ghp_");
  const report = feed.getByRole("region", { name: "Compte rendu" });
  await expect(report.getByRole("heading", { name: "À vérifier (2)" })).toBeVisible();
  await bar().click({ position: EDGE });

  await page.goto(`/#/p/${seeded.projectId}/t/${ticketOf(v, 14)}`);
  await page.getByRole("tab", { name: "Activité" }).click();
  const chronology = page.getByRole("region", { name: "Chronologie", exact: true });
  await expect(chronology).toBeVisible();
  await expect(page.getByText("1 fichier modifié non mentionné")).toBeVisible();
  await expect(page.getByText("Message d'erreur de l'e-mail vide")).toBeVisible();
  await capture(page, info, "185");
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(chronology).toBeHidden();
  await expect(page.getByRole("region", { name: "Chronologie des runs" })).toBeVisible();
  await expect(page.getByText("1 fichier modifié non mentionné")).toBeVisible();
  await capture(page, info, "185b");
  await page.setViewportSize(WIDE);
});

test("un run sans plan reçoit le rappel, puis remet son compte rendu", async () => {
  const info = test.info();
  const runId = await assignOpus(v, 16);
  await expect.poll(() => runState(page, "KIB-16"), { timeout: 30_000 }).toBe("done");
  await page.goto(`/#/runs/${runId}`);
  const feed = page.getByRole("region", { name: "Fil narratif" });
  await expect(feed.getByText("Kibo a rappelé de déclarer le plan")).toBeVisible();
  await expect(feed.getByText("Kibo a rappelé de remplir le compte rendu")).toBeVisible();
  await expect(page.getByText("Libellé du bouton corrigé.")).toBeVisible();
  await capture(page, info, "184b");
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
  expect(copied).toContain("Question : Exporter les pièces jointes ?");
  expect(copied).toContain("Destinataire : Client");
  await expect(card.getByText(/^envoyée/)).toBeVisible();
  await page.getByRole("button", { name: "Exporter tout (2)" }).click();
  const all = await page.evaluate(() => navigator.clipboard.readText());
  expect(all).toContain("Importer les issues fermées ?");
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

test("le graphe se lit par vagues, focus, zoom éloigné et cadres par étiquette", async () => {
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
  await expect(canvas.getByText("Vague 1 · démarrables et en cours")).toBeVisible();
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

test("le Kanban signale les tickets démarrables et les filtre", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await page.getByRole("radio", { name: "Tous" }).click();
  const startable = page.getByRole("button", { name: "Démarrables" });
  await startable.click();
  await expect(startable).toHaveAttribute("aria-pressed", "true");
  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  await expect(cards.filter({ hasText: "Démarrable" })).toHaveCount(count);
  await expect(cards.filter({ hasText: "KIB-21" })).toHaveCount(0);
  await capture(page, info, "188k");
  await startable.click();
});
