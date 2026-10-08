import { expect, type Page, test } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { addComponent, createPage, createSidebarPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const ADMIN = "Un admin non affecté accède-t-il aux fichiers ?";
const ARCHIVE = "Bloquer le dépôt sur une affaire archivée ?";

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

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
