import { expect, type Locator, type Page, test } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { addComponent, createPage, createSidebarPage, pairAndCreateProject } from "./helpers";
import {
  capture,
  expandQuestion,
  hoverBadge,
  questionArticle,
  seedAnswered,
  seedQuestion,
} from "./questions-kit";
import { shot } from "./repo-project";
import { openAgentList, sayToAgent as say, userBubbles } from "./suivi-kit";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const PROJECT = "Kibo KIB";

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

async function seed(page: Page, projectId: string): Promise<void> {
  for (const title of ["Récepteur de hooks", "Documentation"])
    await rpc(page, {
      method: "command",
      projectId,
      command: { method: "createTicket", title, statusId: "todo" },
    });
}

const panelOf = (page: Page): Locator => page.getByRole("dialog", { name: `Agent de projet · ${PROJECT}` });

async function openProjectPanel(page: Page, projectId: string): Promise<Locator> {
  await page.goto(`/#/p/${encodeURIComponent(projectId)}/`);
  await expect(page.getByRole("button", { name: /^Agent de projet/ })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+j");
  const panel = panelOf(page);
  await expect(panel).toBeVisible();
  return panel;
}

async function expectDocked(panel: Locator, header: Locator): Promise<void> {
  const panelBox = await panel.boundingBox();
  const headerBox = await header.boundingBox();
  if (!panelBox || !headerBox) throw new Error("panel or header not laid out");
  expect(panelBox.y).toBeLessThanOrEqual(headerBox.y);
  expect(headerBox.x + headerBox.width).toBeLessThanOrEqual(panelBox.x);
  expect(panelBox.width).toBe(341);
}

test("l'agent de projet lit le projet, propose un lot, et l'éditeur le valide d'un clic", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await pairAndCreateProject(page, info, "KIB");
  const projectId = projectIdOf(page);
  await seed(page, projectId);
  await createPage(page, "Tableau de bord", "Tableau de bord");
  await addComponent(page, "Kanban");
  const kanban = page.locator("[data-instance]").first();
  const all = kanban.getByRole("button", { name: "Tous", exact: true });
  if ((await all.getAttribute("aria-pressed")) !== "true") await all.click();
  await expect(
    kanban.getByRole("region", { name: "À faire" }).getByText("KIB-1", { exact: true }),
  ).toBeVisible();

  const button = page.getByRole("button", { name: "Agent de projet", exact: true });
  await button.click();
  const panel = panelOf(page);
  await expect(panel).toBeVisible();
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("navigation", { name: "Fil d'Ariane" })).toBeVisible();
  await expectDocked(panel, button);
  await button.click();
  await expect(panel).toBeHidden();
  await button.click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Fermer le panneau" }).click();
  await expect(panel).toBeHidden();
  await page.keyboard.press("ControlOrMeta+j");
  await expect(panel).toBeVisible();

  await say(panel, "Où en est-on ?");
  await expect(panel.getByText("J'ai proposé un lot de 5 actions.")).toBeVisible({ timeout: 30_000 });
  const card = panel.getByRole("region", { name: "Lot n° 1" });
  await expect(card).toBeVisible();
  const agentButton = page.getByRole("button", { name: /Agent de projet · 5 actions à valider/ });
  await expect(agentButton).toBeVisible();
  await expect(agentButton.locator("[data-pending]")).toHaveCount(0);
  await shot(page, info, "ecran-174");
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("checkbox", { name: /Faut-il la doc/ }).click();
  await shot(page, info, "ecran-175");
  await card.getByRole("button", { name: "Valider (4)" }).click();
  await expect(card.getByText("Appliqué en partie")).toBeVisible();
  await expect(card.getByText("Appliquée", { exact: true })).toHaveCount(4);
  await expect(card.getByText("Ignorée", { exact: true })).toHaveCount(1);
  await expect(card.getByText("KIB-3", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: /^Valider/ })).toHaveCount(0);
  await shot(page, info, "ecran-175b");
  await expect(
    kanban.getByRole("region", { name: "En cours" }).getByText("KIB-1", { exact: true }),
  ).toBeVisible();

  await say(panel, "Propose un lot invalide");
  await expect(panel.getByText("Lot corrigé.")).toBeVisible({ timeout: 30_000 });
  await expect(userBubbles(panel, "Propose un lot invalide")).toHaveCount(1);
  const second = panel.getByRole("region", { name: "Lot n° 2" });
  await second.getByRole("button", { name: /^Valider/ }).click();
  await expect(second.getByText("Appliquée", { exact: true })).toHaveCount(1);
  await expect(second.getByRole("button", { name: /^Valider/ })).toHaveCount(0);
  await shot(page, info, "ecran-175c");

  await say(panel, "Propose encore un lot invalide");
  await expect(panel.getByText("Lot corrigé.")).toHaveCount(2, { timeout: 30_000 });
  const third = panel.getByRole("region", { name: "Lot n° 3" });
  await expect(third).toBeVisible();
  await third.getByRole("button", { name: "Refuser" }).click();
  await third.getByLabel("Commentaire pour l'agent (facultatif)").fill("Pas cette semaine");
  await third.getByRole("button", { name: "Confirmer le refus" }).click();
  await expect(third.getByText("Refusé", { exact: true })).toBeVisible();
  await expect(panel.getByText("Compris, je retire la proposition.")).toBeVisible({ timeout: 30_000 });

  await panel.getByRole("button", { name: "Nouvel agent", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Nouvel agent", exact: true }).click();
  await expect(panel.getByRole("region", { name: /^Lot n° / })).toHaveCount(0);
  const list = await openAgentList(panel);
  const past = list.getByRole("button", { name: /^Où en est-on \?/ });
  await expect(past).toHaveCount(1);
  await shot(page, info, "ecran-176");
  await past.click();
  await expect(panel.getByText(/^Ancien agent · /)).toBeVisible();
  await expect(panel.getByRole("region", { name: "Lot n° 1" })).toBeVisible();
});

const COLOR = "Client - Couleur ?";
const FONT = "Client - Police ?";
const LOGO = "Client - Logo ?";

async function kibProject(page: Page): Promise<string> {
  await pairBrowser(page);
  const projects = list({ projects: await rpc(page, { method: "listProjects" }) }, "projects");
  const found = projects.find((p) => text(p, "name") === PROJECT);
  if (found !== undefined) return text(found, "id");
  const created = await rpc(page, {
    method: "createProject",
    name: PROJECT,
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const projectId = text(created, "id");
  await seed(page, projectId);
  return projectId;
}

async function ticketIdOf(page: Page, projectId: string, key: string): Promise<string> {
  const tickets = list(await rpc(page, { method: "getProject", projectId }), "tickets");
  const found = tickets.find((t) => text(t, "key") === key);
  if (found === undefined) throw new Error(`no ticket ${key}`);
  return text(found, "id");
}

async function seedProjectQuestions(page: Page, projectId: string): Promise<void> {
  const first = await ticketIdOf(page, projectId, "KIB-1");
  const command = { method: "createTicket", title: "Logo du client", statusId: "todo" };
  const leaf = text(await rpc(page, { method: "command", projectId, command }), "id");
  await seedQuestion(page, projectId, first, COLOR, { recipient: "client" });
  await seedAnswered(page, projectId, first, FONT, "Oui", { recipient: "client" });
  await seedAnswered(page, projectId, leaf, LOGO, "Oui", { recipient: "client" });
}

const lastBatch = (panel: Locator): Locator => panel.getByRole("region", { name: /^Lot n° \d+$/ }).last();

test("l'agent de projet renomme, réassigne, rouvre et archive des questions", async ({ page }, info) => {
  test.setTimeout(180_000);
  const projectId = await kibProject(page);
  await seedProjectQuestions(page, projectId);
  const panel = await openProjectPanel(page, projectId);

  await say(panel, "Peux-tu ranger les questions ?");
  await expect(panel.getByText("J'ai proposé un lot de 6 actions sur les questions.")).toBeVisible({
    timeout: 30_000,
  });
  const card = lastBatch(panel);
  await expect(card.getByText("Ajouter le destinataire « Galadrim »")).toBeVisible();
  await expect(card.getByText(/^Question sur KIB-1 pour Galadrim : « Quel hébergeur \? »$/)).toBeVisible();
  await expect(card.getByText("Question sur KIB-2 pour Client : « Quelle licence ? »")).toBeVisible();
  const rename = card.getByRole("button", { name: `Modifier la question « ${COLOR} »` });
  await expect(rename).toBeVisible();
  await expect(card.getByText("Titre :")).toBeVisible();
  await expect(card.getByText("Destinataire :")).toBeVisible();
  const reopen = card.getByRole("button", { name: `Rouvrir « ${LOGO} » (réponse retirée)` });
  await expect(reopen).toBeVisible();
  await expect(card.getByRole("button", { name: `Archiver « ${FONT} »` })).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await shot(page, info, "204");
  const preview = await hoverBadge(page, reopen);
  await expect(preview.getByText(/Décision prise provisoirement/)).toBeVisible();
  await capture(page, info, "205b");
  await page.mouse.move(0, 0);

  await card.getByRole("button", { name: "Valider (6)" }).click();
  await expect(card.getByText("Appliquée", { exact: true })).toHaveCount(6);
  await panel.getByRole("button", { name: "Fermer le panneau" }).click();

  await createSidebarPage(page, PROJECT, "Questions", "Vue");
  await addComponent(page, "Questions");
  const view = page.getByRole("main");
  await expandQuestion(questionArticle(view, "Couleur ?"));
  await expect(
    questionArticle(view, "Couleur ?").getByRole("button", { name: "Destinataire : Galadrim" }),
  ).toBeVisible();
  await expandQuestion(questionArticle(view, LOGO));
  await expect(questionArticle(view, LOGO).getByRole("form", { name: `Répondre à ${LOGO}` })).toBeVisible();
  await expect(questionArticle(view, FONT)).toHaveCount(0);
  await view.getByRole("radio", { name: "Archivées" }).click();
  await expandQuestion(questionArticle(view, FONT));
  await expect(questionArticle(view, FONT).getByRole("button", { name: "Restaurer" })).toBeVisible();
});

test("la réponse de l'agent de projet montre un tableau, qu'Agrandir ouvre dans un volet", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const projectId = await kibProject(page);
  const panel = await openProjectPanel(page, projectId);
  await say(panel, "Donne-moi l'ordre en tableau");
  const table = panel.getByRole("region", { name: "Tableau" }).last().getByRole("table");
  await expect(table).toBeVisible({ timeout: 30_000 });
  await expect(table.getByRole("columnheader")).toHaveText(["Ordre", "Ticket", "Ce que ça donne", "Attend"]);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await shot(page, info, "a4-tableau-fil");

  const expand = panel.getByRole("button", { name: "Agrandir le tableau" }).last();
  await expand.click();
  const sheet = page.getByRole("dialog", { name: "Tableau" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("2 lignes · 4 colonnes")).toBeVisible();
  await expect(sheet.getByRole("table").locator("tbody tr")).toHaveCount(2);
  await expect(sheet.getByRole("button", { name: "Copier en Markdown" })).toBeVisible();
  await shot(page, info, "a4-tableau-volet");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(expand).toBeFocused();
  await expect(panel).toBeVisible();
});
