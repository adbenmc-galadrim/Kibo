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

async function pointIn(target: Locator, across = 0.5): Promise<{ x: number; y: number }> {
  const box = await target.boundingBox();
  if (!box) throw new Error("element not laid out");
  return { x: box.x + box.width * across, y: box.y + box.height / 2 };
}

const scrollLeftOf = (board: Locator) => board.evaluate((el) => el.scrollLeft);

const scrollers = (root: Locator) =>
  root.evaluate((el) =>
    [el, ...Array.from(el.querySelectorAll('[data-slot="kanban-cards"]'))].flatMap((node) =>
      node instanceof HTMLElement
        ? [{ x: node.scrollWidth - node.clientWidth, y: node.scrollHeight - node.clientHeight }]
        : [],
    ),
  );

const previewAt = (page: Page, point: { x: number; y: number } | null) =>
  page.evaluate(
    ([selector, at]) => {
      const preview = document.querySelector(selector);
      if (!preview) return false;
      const box = preview.getBoundingClientRect();
      const { x, y } = at ?? { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const hit = document.elementFromPoint(x, y);
      return hit !== null && preview.contains(hit);
    },
    [PREVIEW, point] as const,
  );

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

  await card.hover();
  const from = await pointIn(card);
  const to = await pointIn(doing, 0.25);
  const scrolled = await scrollLeftOf(board);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });

  const preview = page.locator(PREVIEW);
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(title);
  await expect(doing).toHaveClass(/ring-2/);
  expect(await previewAt(page, null)).toBe(true);
  expect(await previewAt(page, to)).toBe(true);
  expect(await card.evaluate((el) => el.style.transform)).toBe("");
  await expect(card).toHaveClass(/opacity-40/);
  expect(await scrollers(board)).toEqual([boardGap, ...columnGaps]);
  expect(await scrollLeftOf(board)).toBe(scrolled);
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

async function previewFollowsAutoScroll(page: Page, root: Locator, title: string) {
  const todo = root.getByRole("region", { name: "À faire" });
  const board = todo.locator("xpath=..");
  const card = todo.getByRole("article", { name: new RegExp(title) });
  await card.hover();
  const from = await pointIn(card);
  const edge = await pointIn(board, 1);
  edge.x -= 8;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 10, { steps: 4 });
  await page.mouse.move(edge.x, edge.y, { steps: 12 });
  await expect
    .poll(() => board.evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft))
    .toBeLessThanOrEqual(1);
  await expect.poll(() => previewAt(page, edge)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(PREVIEW)).toHaveCount(0);
  await expect(card).toBeVisible();
}

test("glisser une carte : l'aperçu passe au-dessus des colonnes, sans barre de défilement", async ({
  page,
}, info) => {
  const run = String.fromCharCode(65 + ((info.repeatEachIndex + info.retry) % 26));
  const key = projectKey(`DR${run}`, info);
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
  await previewFollowsAutoScroll(page, widget, "Voisine 1");
});

const previewLeft = (page: Page) =>
  page.locator(PREVIEW).evaluate((el) => Math.round(el.getBoundingClientRect().left));

// dnd-kit KeyboardSensor listens to keydown only after a setTimeout following activation.
async function stepRight(page: Page) {
  const start = await previewLeft(page);
  await expect(async () => {
    if ((await previewLeft(page)) === start) await page.keyboard.press("ArrowRight");
    expect(await previewLeft(page)).toBeGreaterThan(start);
  }).toPass({ intervals: [1_000] });
}

test("glisser une carte au clavier : Espace, flèche droite, Espace", async ({ page }, info) => {
  test.setTimeout(60_000);
  const run = String.fromCharCode(65 + ((info.repeatEachIndex + info.retry) % 26));
  const key = projectKey(`DK${run}`, info);
  await pairAndCreateProject(page, info, key);
  const projectId = projectIdOf(page);
  await rpc(page, {
    method: "command",
    projectId,
    command: { method: "createTicket", title: "Carte au clavier", statusId: "todo" },
  });
  await createSidebarPage(page, `Kibo ${key}`, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const main = page.getByRole("main");
  await showAllTickets(main);
  const todo = main.getByRole("region", { name: "À faire" });
  const doing = main.getByRole("region", { name: "En cours" });
  const card = todo.getByRole("article", { name: /Carte au clavier/ });
  await card.focus();
  await page.keyboard.press("Space");
  await expect(page.locator(PREVIEW)).toBeVisible();
  await stepRight(page);
  await expect(doing).toHaveClass(/ring-2/);
  await shot(page, info, "kanban-clavier");
  await page.keyboard.press("Space");
  await expect(page.locator(PREVIEW)).toHaveCount(0);
  await expect(doing.getByRole("article", { name: /Carte au clavier/ })).toBeVisible();
  await expect(todo.getByRole("article", { name: /Carte au clavier/ })).toHaveCount(0);

  await page.reload();
  await showAllTickets(main);
  await expect(doing.getByRole("article", { name: /Carte au clavier/ })).toBeVisible();
  await expect(todo.getByRole("article", { name: /Carte au clavier/ })).toHaveCount(0);
});
