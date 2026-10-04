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
