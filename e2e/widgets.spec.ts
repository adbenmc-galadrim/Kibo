import { collectBoxes, overflowViolations } from "@kibo/sdk/conformance-overflow";
import { expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { addComponent, createPage, createSidebarPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

async function showAllTickets(root: Locator) {
  const all = root.getByRole("radio", { name: "Tous" });
  if ((await all.getAttribute("aria-checked")) !== "true") await all.click();
  await expect(all).toHaveAttribute("aria-checked", "true");
}

async function expectColumnScrollsInside(page: Page, root: Locator, info: TestInfo, name: string) {
  await showAllTickets(root);
  const column = root.getByRole("region", { name: "À faire" });
  await expect(column.getByRole("button", { name: /Carte 14$/ })).toBeAttached();
  const tree = await root.evaluate(collectBoxes);
  expect(overflowViolations(tree)).toEqual([]);
  const cards = column.locator('[data-slot="kanban-cards"]');
  expect(await cards.evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);
  const columnBox = await column.boundingBox();
  const cardsBox = await cards.boundingBox();
  if (!columnBox || !cardsBox) throw new Error("column not laid out");
  expect(cardsBox.y + cardsBox.height).toBeLessThanOrEqual(columnBox.y + columnBox.height + 1);
  await shot(page, info, name);
}

test("le Kanban défile dans ses colonnes en Large, Demi-page et Plein écran", async ({ page }, info) => {
  const key = projectKey("WID", info);
  await pairAndCreateProject(page, info, key);
  const projectId = projectIdOf(page);
  for (let i = 1; i <= 14; i++) {
    await rpc(page, {
      method: "command",
      projectId,
      command: { method: "createTicket", title: `Carte ${i}`, statusId: "todo" },
    });
  }
  await createPage(page, "Tableau de bord", "Tableau de bord");
  await addComponent(page, "Kanban");
  const widget = page.locator("[data-instance]").first();
  await expectColumnScrollsInside(page, widget, info, "kanban-large");

  await page.getByRole("button", { name: "Modifier la disposition" }).click();
  await page.getByRole("button", { name: "Format de Kanban" }).click();
  await page.getByRole("menuitemradio", { name: /^Demi-page/ }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("toolbar", { name: "Disposition" })).toHaveCount(0);
  await expectColumnScrollsInside(page, widget, info, "kanban-half");

  await createSidebarPage(page, `Kibo ${key}`, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  await expectColumnScrollsInside(page, page.getByRole("main"), info, "kanban-full");
});

test("les étiquettes filtrent les Tickets et le Kanban, la fiche les modifie", async ({ page }, info) => {
  const key = projectKey("LAB", info);
  await pairAndCreateProject(page, info, key);
  const projectId = projectIdOf(page);
  const create = (title: string, labels: string[]) =>
    rpc(page, { method: "command", projectId, command: { method: "createTicket", title, labels } });
  await create("Contrat de l'API", ["area:api", "phase:p1", "urgent"]);
  await create("Écran de connexion", ["area:web", "phase:p1"]);
  await create("Sans étiquette", []);
  await createPage(page, "Étiquettes", "Tableau de bord");
  await addComponent(page, "Tickets");
  const tickets = page.locator("[data-instance]").first();
  await expect(tickets.getByText("Contrat de l'API")).toBeVisible();
  await tickets.getByRole("button", { name: "Étiquettes" }).click();
  await page.getByRole("menuitemcheckbox", { name: "area:api" }).click();
  await page.keyboard.press("Escape");
  await expect(tickets.getByText("Écran de connexion")).toHaveCount(0);
  await expect(tickets.getByText("Sans étiquette")).toHaveCount(0);
  await expect(tickets.getByRole("button", { name: "Contrat de l'API" })).toHaveCount(1);
  await shot(page, info, "labels-tickets");

  await addComponent(page, "Kanban");
  const kanban = page.locator("[data-instance]").nth(1);
  await showAllTickets(kanban);
  await kanban.getByRole("button", { name: "Étiquette : toutes" }).click();
  await page.getByRole("menuitemradio", { name: "phase:p1" }).click();
  await expect(kanban.getByRole("article")).toHaveCount(2);
  await shot(page, info, "labels-kanban");

  await tickets.getByRole("button", { name: "Contrat de l'API" }).click();
  const sheet = page.getByRole("dialog");
  const field = sheet.getByRole("textbox", { name: "Ajouter une étiquette" });
  await field.fill("Mauvaise");
  await field.press("Enter");
  await expect(sheet.getByRole("alert")).toHaveText(
    "Étiquette invalide : minuscules, chiffres, : _ . / -, 40 caractères.",
  );
  await field.fill("sprint:s2");
  await field.press("Enter");
  await expect(sheet.getByRole("group", { name: "Étiquettes" }).getByText("sprint:s2")).toBeVisible();
  await shot(page, info, "labels-sheet");
});
