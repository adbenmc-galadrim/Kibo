import { expect, type Locator, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { addComponent, createSidebarPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.use({ viewport: { width: 1440, height: 900 } });

const PREVIEW = '[data-slot="kanban-drag-preview"]';

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

async function centerOf(target: Locator): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (!box) throw new Error("element not laid out");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const scrollers = (root: Locator) =>
  root.evaluate((el) =>
    [el, ...Array.from(el.querySelectorAll('[data-slot="kanban-cards"]'))].flatMap((node) =>
      node instanceof HTMLElement
        ? [{ x: node.scrollWidth - node.clientWidth, y: node.scrollHeight - node.clientHeight }]
        : [],
    ),
  );

const previewOnTop = (page: Page) =>
  page.evaluate((selector) => {
    const preview = document.querySelector(selector);
    if (!preview) return false;
    const box = preview.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && preview.contains(hit);
  }, PREVIEW);

const FLAT = { x: 0, y: 0 };

async function showAllTickets(root: Locator) {
  const all = root.getByRole("radio", { name: "Tous" });
  if ((await all.getAttribute("aria-checked")) !== "true") await all.click();
  await expect(all).toHaveAttribute("aria-checked", "true");
}

async function dragToInProgress(page: Page, root: Locator, title: string) {
  await showAllTickets(root);
  const todo = root.getByRole("region", { name: "À faire" });
  const doing = root.getByRole("region", { name: "En cours" });
  const board = todo.locator("xpath=..");
  const card = todo.getByRole("article", { name: new RegExp(title) });
  await expect(card).toBeVisible();
  const [boardGap, ...columnGaps] = await scrollers(board);
  expect(boardGap?.y).toBe(0);
  for (const gap of columnGaps) expect(gap).toEqual(FLAT);

  const from = await centerOf(card);
  const to = await centerOf(doing);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });

  const preview = page.locator(PREVIEW);
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(title);
  await expect(doing).toHaveClass(/ring-2/);
  expect(await previewOnTop(page)).toBe(true);
  expect(await scrollers(board)).toEqual([boardGap, ...columnGaps]);
  return {
    board: boardGap,
    drop: async () => {
      await page.mouse.up();
      await expect(preview).toHaveCount(0);
      await expect(doing.getByRole("article", { name: new RegExp(title) })).toBeVisible();
      await expect(todo.getByRole("article", { name: new RegExp(title) })).toHaveCount(0);
    },
  };
}

test("glisser une carte : l'aperçu passe au-dessus des colonnes, sans barre de défilement", async ({
  page,
}, info) => {
  const key = projectKey("DRG", info);
  await pairAndCreateProject(page, info, key);
  const projectId = projectIdOf(page);
  for (const title of ["Carte du tableau", "Carte de la vue", "Voisine 1", "Voisine 2"]) {
    await rpc(page, {
      method: "command",
      projectId,
      command: { method: "createTicket", title, statusId: "todo" },
    });
  }

  await createSidebarPage(page, `Kibo ${key}`, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const view = await dragToInProgress(page, page.getByRole("main"), "Carte de la vue");
  expect(view.board).toEqual(FLAT);
  await shot(page, info, "kanban-glisser-vue");
  await view.drop();

  await createSidebarPage(page, `Kibo ${key}`, "Suivi", "Tableau de bord");
  await addComponent(page, "Kanban");
  const widget = page.locator("[data-instance]").first();
  const dashboard = await dragToInProgress(page, widget, "Carte du tableau");
  await shot(page, info, "kanban-glisser-tableau");
  await dashboard.drop();
});
