import { expect, type Locator, type Page, test } from "@playwright/test";
import { createAgent, livraisonOpus, rpc, runState, showAgentExecution, text } from "./agents-seed";
import { addComponent, createPage, createSidebarPage, pairAndCreateProject } from "./helpers";
import {
  capture,
  hoverBadge,
  projectIdOf,
  questionArticle,
  seedAnswered,
  seedQuestion,
  seedTicket,
} from "./questions-kit";
import { projectKey, shot } from "./repo-project";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const ADMIN = "Un admin non affecté accède-t-il aux fichiers ?";
const ARCHIVE = "Bloquer le dépôt sur une affaire archivée ?";

async function seedQuestions(page: Page, projectId: string): Promise<void> {
  const command = (cmd: Record<string, unknown>) => rpc(page, { method: "command", projectId, command: cmd });
  const ticketId = text(
    await command({ method: "createTicket", title: "Stockage S3", statusId: "todo" }),
    "id",
  );
  for (const title of [ADMIN, ARCHIVE]) {
    await command({
      method: "createQuestion",
      ticketId,
      title,
      context: "Décision prise **provisoirement** par le run pilote.\n\n- refusé pour l'instant",
      options: ["Oui", "Non"],
      provisional: "Non",
      createdBy: { kind: "agent", ref: "emis-livraison" },
    });
  }
}

test("le widget et la vue Questions répondent, filtrent et créent", async ({ page }, info) => {
  const key = projectKey("QST", info);
  await pairAndCreateProject(page, info, key);
  await showAgentExecution(page);
  await seedQuestions(page, projectIdOf(page));

  await createPage(page, "Tableau de bord", "Tableau de bord");
  await addComponent(page, "Kanban");
  await addComponent(page, "Questions");
  const kanban = page.locator("[data-instance]").first();
  const all = kanban.getByRole("radio", { name: "Tous" });
  if ((await all.getAttribute("aria-checked")) !== "true") await all.click();
  const card = kanban.getByRole("article", { name: /Stockage S3/ });
  await expect(card.getByText("2 questions")).toBeVisible();

  const widget = page.locator("[data-instance]").nth(1);
  await expect(widget.getByText("Questions ouvertes · 2")).toBeVisible();
  await expect(widget.getByText(ADMIN)).toBeVisible();
  await expect(widget.getByText(ARCHIVE)).toBeVisible();
  await widget.getByRole("button", { name: new RegExp(ARCHIVE.slice(0, 20)) }).click();
  await expect(widget.getByRole("button", { name: "Valider le choix provisoire" })).toBeVisible();
  await shot(page, info, "ecran-170");
  await widget.getByRole("button", { name: "Valider le choix provisoire" }).click();
  await expect(widget.getByText("Questions ouvertes · 1")).toBeVisible();
  await expect(card.getByText("1 question", { exact: true })).toBeVisible();
  await expect(widget.getByRole("button", { name: /Transmettre à l'agent \(1\)/ })).toBeVisible();

  await card.getByRole("button", { name: "Stockage S3" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "1 question" })).toBeVisible();
  await shot(page, info, "ecran-170-fiche");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await createSidebarPage(page, `Kibo ${key}`, "Questions", "Vue");
  await addComponent(page, "Questions");
  const view = page.getByRole("main");
  await expect(view.getByRole("article", { name: ADMIN })).toBeVisible();
  await expect(view.getByRole("article", { name: ARCHIVE })).toHaveCount(0);
  await view.getByRole("radio", { name: "Répondues" }).click();
  const answered = view.getByRole("article", { name: ARCHIVE });
  await expect(answered.getByText(/^Répondu par /)).toBeVisible();
  await expect(answered.getByText("à transmettre")).toBeVisible();
  await view.getByRole("radio", { name: "Toutes" }).click();
  await shot(page, info, "ecran-171");

  await view.getByRole("button", { name: "Nouvelle question" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Ticket" }).click();
  await page.getByRole("option", { name: /Stockage S3/ }).click();
  await dialog.getByRole("textbox", { name: "Question" }).fill("Chiffrer les fichiers au repos ?");
  await dialog.getByRole("textbox", { name: "Options, une par ligne" }).fill("Oui\nNon");
  await shot(page, info, "ecran-171-nouvelle");
  await dialog.getByRole("button", { name: "Créer la question" }).click();
  await expect(dialog).toBeHidden();
  await expect(view.getByRole("article", { name: "Chiffrer les fichiers au repos ?" })).toBeVisible();
  await expect(view.getByRole("article")).toHaveCount(3);
});

const CIPHER = "Chiffrer les fichiers au repos ?";
const PURGE = "Purger les fichiers après un an ?";
const FORMAT = "Exporter en CSV ou en JSON ?";
const PORT = "Quel port pour le récepteur ?";
const LOGO = "Quel logo pour l'export ?";

async function showAllCards(page: Page): Promise<Locator> {
  const kanban = page.locator("[data-instance]").first();
  const all = kanban.getByRole("radio", { name: "Tous" });
  if ((await all.getAttribute("aria-checked")) !== "true") await all.click();
  return kanban;
}

async function confirm(page: Page, label: string): Promise<void> {
  await page.getByRole("alertdialog").getByRole("button", { name: label }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
}

async function answerBlockingQuestion(page: Page, view: Locator, projectId: string, key: string) {
  const agent = await createAgent(page, livraisonOpus("isolated"));
  const ticketId = await seedTicket(page, projectId, "Port du récepteur");
  await rpc(page, { method: "assignAgent", projectId, ticketId, profileId: agent, brief: "" });
  await expect.poll(() => runState(page, `${key}-4`), { timeout: 20_000 }).toBe("waiting_input");
  const port = questionArticle(view, PORT);
  await port.getByRole("textbox", { name: "Autre réponse…" }).fill("8080");
  await port.getByRole("textbox", { name: "Autre réponse…" }).press("Enter");
  await expect(port.getByText(/^transmise à .*livraison-opus.* · figée$/)).toBeVisible();
  await expect(port.getByRole("button", { name: "Modifier la réponse" })).toHaveCount(0);
  await expect(port.getByRole("button", { name: "Retirer la réponse" })).toHaveCount(0);
  await expect.poll(() => runState(page, `${key}-4`), { timeout: 20_000 }).toBe("done");
}

test("les réponses se modifient tant qu'elles ne sont pas transmises, les questions s'archivent et se retrouvent", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const key = projectKey("QSR", info);
  await pairAndCreateProject(page, info, key);
  await showAgentExecution(page);
  const projectId = projectIdOf(page);
  const storage = await seedTicket(page, projectId, "Stockage S3");
  const exports = await seedTicket(page, projectId, "Export des affaires");
  const cipher = await seedTicket(page, projectId, "Chiffrement");
  for (const title of [ADMIN, ARCHIVE]) await seedQuestion(page, projectId, storage, title);
  await seedQuestion(page, projectId, exports, FORMAT, { options: ["CSV", "JSON"] });
  await seedAnswered(page, projectId, cipher, CIPHER, "Oui");
  await seedAnswered(page, projectId, cipher, PURGE, "Non");

  await createPage(page, "Tableau de bord", "Tableau de bord");
  await addComponent(page, "Kanban");
  const dashboard = page.url();
  await createSidebarPage(page, `Kibo ${key}`, "Questions", "Vue");
  await addComponent(page, "Questions");
  const view = page.getByRole("main");
  await view.getByRole("radio", { name: "Toutes" }).click();

  const answered = questionArticle(view, CIPHER);
  await answered.getByRole("button", { name: "Modifier la réponse" }).click();
  const form = answered.getByRole("form", { name: `Modifier la réponse à ${CIPHER}` });
  await expect(form.getByRole("button", { name: "Oui" })).toHaveAttribute("aria-pressed", "true");
  await answered.scrollIntoViewIfNeeded();
  await capture(page, info, "202b");
  await form.getByRole("button", { name: "Non" }).click();
  await form.getByRole("button", { name: "Enregistrer" }).click();
  await expect(answered.getByText("Réponse : Non")).toBeVisible();
  await answered.getByRole("button", { name: "Retirer la réponse" }).click();
  await confirm(page, "Retirer la réponse");
  await expect(answered.getByRole("form", { name: `Répondre à ${CIPHER}` })).toBeVisible();
  await answered.getByText("Historique (2)").click();
  await expect(answered.getByText(/Réponse modifiée \(« Oui » → « Non »\)$/)).toBeVisible();
  await expect(answered.getByText(/Rouverte \(réponse « Non » retirée\)$/)).toBeVisible();
  await capture(page, info, "203b");

  await answerBlockingQuestion(page, view, projectId, key);
  await expect(questionArticle(view, PURGE).getByText("à transmettre")).toBeVisible();
  await questionArticle(view, PORT).scrollIntoViewIfNeeded();
  await capture(page, info, "202");

  const purge = questionArticle(view, PURGE);
  await purge.getByRole("button", { name: "Archiver" }).click();
  await confirm(page, "Archiver");
  await expect(purge).toHaveCount(0);
  await view.getByRole("radio", { name: "Archivées" }).click();
  await expect(purge.getByRole("button", { name: "Restaurer" })).toBeVisible();
  await purge.getByText("Historique (1)").click();
  await expect(purge.getByText(/ · Archivée$/)).toBeVisible();
  await capture(page, info, "203");
  await purge.getByRole("button", { name: "Restaurer" }).click();
  await expect(purge).toHaveCount(0);
  await view.getByRole("radio", { name: "Toutes" }).click();
  await expect(purge.getByText("Réponse : Non")).toBeVisible();

  await view.getByRole("button", { name: "Nouvelle question" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Ticket" }).click();
  await page.getByRole("option", { name: /Chiffrement/ }).click();
  await dialog.getByRole("textbox", { name: "Question" }).fill(LOGO);
  await dialog.getByRole("combobox", { name: "Destinataire" }).click();
  await page.getByRole("option", { name: "Client" }).click();
  await dialog.getByRole("button", { name: "Créer la question" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    questionArticle(view, LOGO).getByRole("button", { name: "Destinataire : Client" }),
  ).toBeVisible();

  await page.goto(dashboard);
  const kanban = await showAllCards(page);
  const card = kanban.getByRole("article", { name: /Stockage S3/ });
  const chip = card.getByRole("button", { name: "2 questions, ouvrir" });
  const preview = await hoverBadge(page, chip);
  await expect(preview.getByText(ADMIN)).toBeVisible();
  await expect(preview.getByText(ARCHIVE)).toBeVisible();
  await capture(page, info, "205");
  await chip.click();
  await expect(page).toHaveURL(/\?question=/);
  const aimed = questionArticle(page.getByRole("main"), ADMIN);
  await expect(aimed).toHaveAttribute("data-spotlight", "bounce");
  await expect(aimed).toBeInViewport();
  await capture(page, info, "206", "allow");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(dashboard);
  const board = await showAllCards(page);
  await board
    .getByRole("article", { name: /Export des affaires/ })
    .getByRole("button", {
      name: "Export des affaires",
    })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "1 question" }).click();
  const calm = questionArticle(page.getByRole("main"), FORMAT);
  await expect(calm).toHaveAttribute("data-spotlight", "fade");
  const animation = await calm.evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).not.toContain("kibo-spotlight-bounce");
  await page.emulateMedia({ reducedMotion: null });
});
