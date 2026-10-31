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
  const all = root.getByRole("button", { name: "Tous", exact: true });
  if ((await all.getAttribute("aria-pressed")) !== "true") await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
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
  const [draggedBoardGap, ...draggedColumnGaps] = await scrollers(board);
  expect(draggedBoardGap).toEqual(boardGap);
  for (const gap of draggedColumnGaps) expect(gap).toEqual(FLAT);
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
  const scrolled = await scrollLeftOf(board);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 10, { steps: 4 });
  await page.mouse.move(edge.x, edge.y, { steps: 12 });
  await expect.poll(() => scrollLeftOf(board)).toBeGreaterThan(scrolled);
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

const LONG_WORD = "Ajouter_une_validation_tres_longue_sans_espace_pour_le_calcul_du_total_du_panier";
const LONG_WORDS =
  "Relire toutes les étiquettes du tableau de bord et harmoniser les intitulés des colonnes avant la démonstration";

const LONG_PATH =
  "Étape 3 · Première table synchronisée : mettre dans apps/web/src/lib/sync/registry.ts la première table";

const overflowOf = (el: Element) => ({
  x: el.scrollWidth - el.clientWidth,
  y: el.scrollHeight - el.clientHeight,
});

const cardOverflows = (root: Locator) =>
  root.getByRole("article").evaluateAll((cards) =>
    cards.flatMap((card) => {
      const frame = card.getBoundingClientRect();
      const outside = Array.from(card.querySelectorAll("*")).filter(
        (el) => el.getBoundingClientRect().right > frame.right + 0.5,
      );
      return [...(card.scrollWidth > card.clientWidth ? [card] : []), ...outside].map(
        (el) => `${card.getAttribute("data-key")}: ${el.tagName}.${el.getAttribute("class")}`,
      );
    }),
  );

const hiddenBars = (root: Locator) =>
  root.evaluate((el) =>
    [el, ...Array.from(el.querySelectorAll('[data-slot="kanban-cards"]'))].map(
      (node) => getComputedStyle(node).scrollbarWidth,
    ),
  );

test("textes longs : rien ne sort des cartes, aucune barre de défilement", async ({ page }, info) => {
  test.setTimeout(60_000);
  const run = String.fromCharCode(65 + ((info.repeatEachIndex + info.retry) % 26));
  const key = projectKey(`DL${run}`, info);
  await pairAndCreateProject(page, info, key);
  const projectId = projectIdOf(page);
  const create = (command: Record<string, unknown>) =>
    rpc(page, { method: "command", projectId, command: { method: "createTicket", ...command } });
  await create({
    title: LONG_WORD,
    statusId: "todo",
    labels: ["frontend_validation_du_panier_tres_long", "backend"],
    assignee: { kind: "agent", ref: "agent_de_validation_du_panier_tres_long_nom" },
  });
  await create({ title: LONG_WORDS, statusId: "todo", labels: ["ux"] });
  await create({ title: LONG_PATH, statusId: "todo", labels: ["priority:unsorted"] });
  await create({ title: "Carte bloquée", statusId: "blocked", blockedReason: LONG_WORD });

  await createSidebarPage(page, `Kibo ${key}`, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const main = page.getByRole("main");
  await showAllTickets(main);
  const todo = main.getByRole("region", { name: "À faire" });
  const board = todo.locator("xpath=..");
  await expect(todo.getByRole("article")).toHaveCount(3);
  await expect(todo.getByRole("article", { name: /registry\.ts/ }).getByText("Démarrable")).toHaveCount(0);
  await shot(page, info, "kanban-textes-longs");

  expect(await cardOverflows(main)).toEqual([]);
  const [boardGap, ...columnGaps] = await scrollers(board);
  expect(boardGap).toEqual(FLAT);
  for (const gap of columnGaps) expect(gap?.x).toBe(0);
  for (const name of ["Backlog", "En cours", "En review", "Bloqué", "Terminé"]) {
    const column = main.getByRole("region", { name });
    const cards = column.locator('[data-slot="kanban-cards"]');
    const box = (await cards.count()) === 0 ? column : cards;
    expect(await box.evaluate(overflowOf)).toEqual(FLAT);
  }
  expect(await page.locator("[data-viewer]").evaluate(overflowOf)).toEqual(FLAT);

  for (let i = 1; i <= 14; i++) await create({ title: `Carte ${i}`, statusId: "in_progress" });
  const doing = main.getByRole("region", { name: "En cours" });
  await expect(doing.getByRole("article")).toHaveCount(14);
  const cards = doing.locator('[data-slot="kanban-cards"]');
  expect((await cards.evaluate(overflowOf)).y).toBeGreaterThan(0);
  expect(await page.locator("[data-viewer]").evaluate(overflowOf)).toEqual(FLAT);
  expect(new Set(await hiddenBars(board))).toEqual(new Set(["none"]));
  await cards.hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => cards.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await shot(page, info, "kanban-colonne-longue");

  await createSidebarPage(page, `Kibo ${key}`, "Suivi", "Tableau de bord");
  await addComponent(page, "Kanban");
  const widget = page.locator("[data-instance]").first();
  await showAllTickets(widget);
  const widgetBoard = widget.getByRole("region", { name: "À faire" }).locator("xpath=..");
  await expect(widget.getByRole("article")).toHaveCount(18);
  expect(await cardOverflows(widget)).toEqual([]);
  expect(await widgetBoard.locator("xpath=../..").evaluate(overflowOf)).toEqual(FLAT);
  expect(new Set(await hiddenBars(widgetBoard))).toEqual(new Set(["none"]));
  await shot(page, info, "kanban-textes-longs-tableau");
});

async function dragCard(page: Page, card: Locator, column: Locator, during?: () => Promise<void>) {
  await card.hover();
  const from = await pointIn(card);
  const to = await pointIn(column, 0.25);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await expect(column).toHaveClass(/ring-2/);
  await during?.();
  await page.mouse.up();
  await expect(page.locator(PREVIEW)).toHaveCount(0);
}

test("une carte bloquée par une question ne quitte pas Bloqué par glisser", async ({ page }, info) => {
  const run = String.fromCharCode(65 + ((info.repeatEachIndex + info.retry) % 26));
  const key = projectKey(`QH${run}`, info);
  await pairAndCreateProject(page, info, key);
  const projectId = projectIdOf(page);
  const command = (cmd: Record<string, unknown>) => rpc(page, { method: "command", projectId, command: cmd });
  const held = await command({ method: "createTicket", title: "Carte retenue", statusId: "todo" });
  const heldId = typeof held === "object" && held !== null ? String(Reflect.get(held, "id")) : "";
  await command({
    method: "createQuestion",
    ticketId: heldId,
    title: "Quel format pour l'import ?",
    blocking: true,
    createdBy: { kind: "human", ref: "e2e" },
  });
  await command({
    method: "createTicket",
    title: "Carte au statut",
    statusId: "blocked",
    blockedReason: "Client",
  });

  await createSidebarPage(page, `Kibo ${key}`, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const main = page.getByRole("main");
  await showAllTickets(main);
  const blocked = main.getByRole("region", { name: "Bloqué", exact: true });
  const todo = main.getByRole("region", { name: "À faire" });
  const doing = main.getByRole("region", { name: "En cours" });
  const card = (title: string) => main.getByRole("article", { name: new RegExp(title) });
  await expect(blocked.getByRole("article", { name: /Carte retenue/ })).toBeVisible();
  const statusOf = async (title: string) => {
    const snapshot = await rpc(page, { method: "getProject", projectId });
    const tickets = typeof snapshot === "object" && snapshot !== null ? Reflect.get(snapshot, "tickets") : [];
    const found = (Array.isArray(tickets) ? tickets : []).find((t) => Reflect.get(t, "title") === title);
    return found === undefined ? null : Reflect.get(found, "statusId");
  };
  const refusal = page.getByRole("region", { name: new RegExp(`^${key}-\\d+ reste bloqué par Q\\d+$`) });
  const greyed = async () => {
    await expect(doing).toHaveAttribute("data-forbidden", "true");
    await expect(todo).toHaveAttribute("data-forbidden", "true");
    await expect(blocked).not.toHaveAttribute("data-forbidden");
    await expect(page.locator(PREVIEW)).toHaveClass(/cursor-not-allowed/);
  };

  await dragCard(page, card("Carte au statut"), doing, async () => {
    await expect(doing).not.toHaveAttribute("data-forbidden");
  });
  await expect(doing.getByRole("article", { name: /Carte au statut/ })).toBeVisible();
  await expect.poll(() => statusOf("Carte au statut")).toBe("in_progress");

  for (const target of [doing, todo]) {
    await dragCard(page, card("Carte retenue"), target, greyed);
    await expect(refusal).toBeVisible();
    await expect(blocked.getByRole("article", { name: /Carte retenue/ })).toBeVisible();
    expect(await statusOf("Carte retenue")).toBe("todo");
  }
  await shot(page, info, "kanban-bloque-par-question");
  await refusal.getByRole("button", { name: "Répondre" }).click();
  const create = page.getByRole("dialog", { name: "Créer une page Questions ?" });
  await create.getByRole("button", { name: "Créer la page" }).click();
  await expect(
    page.getByRole("main").getByRole("article", { name: "Quel format pour l'import ?" }),
  ).toBeVisible();
});
