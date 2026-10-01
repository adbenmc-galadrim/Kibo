import { type Browser, expect, type Locator, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { addComponent, pairAndCreateProject } from "./helpers";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });

type Cell = { x: number; y: number };
type Box = Cell & { w: number; h: number };

const WIDE = { width: 1440, height: 900 };
const TALL = { width: 1440, height: 1600 };

const ARROWS = {
  ArrowDown: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
} as const;

type Arrow = keyof typeof ARROWS;

const widget = (page: Page, title: string): Locator =>
  page
    .locator("[data-instance]")
    .filter({ has: page.getByText(title, { exact: true }) })
    .first();

const layoutOf = (w: Locator): Promise<string | null> =>
  w.evaluate((el: HTMLElement) => {
    const column = /^(\d+) \/ span (\d+)$/.exec(el.style.gridColumn);
    const row = /^(\d+) \/ span (\d+)$/.exec(el.style.gridRow);
    if (!column || !row) return null;
    return `${Number(column[1]) - 1},${Number(row[1]) - 1},${column[2]},${row[2]}`;
  });

const expectLayout = (w: Locator, layout: string | null) => expect.poll(() => layoutOf(w)).toBe(layout);

const toolbar = (page: Page) => page.getByRole("toolbar", { name: "Disposition" });

const cellText = (c: Cell) => `colonne ${c.x + 1}, rangée ${c.y + 1}`;

const cellOf = async (w: Locator): Promise<string | undefined> =>
  (await layoutOf(w))?.split(",").slice(0, 2).join(",");

async function moveByKeyboard(page: Page, title: string, from: Cell, keys: readonly Arrow[]) {
  const live = page.getByRole("status").filter({ hasText: title });
  const ghost = page.locator("[data-ghost]");
  const ghostCell = async () => ((await ghost.count()) > 0 ? cellOf(ghost) : `${from.x},${from.y}`);
  await page.getByRole("button", { name: `Déplacer ${title}` }).focus();
  await page.keyboard.press("Space");
  await expect(live).toHaveText(`${title} saisi.`);
  let at = from;
  for (const key of keys) {
    const before = `${at.x},${at.y}`;
    at = { x: at.x + ARROWS[key].x, y: at.y + ARROWS[key].y };
    const expected = `${at.x},${at.y}`;
    await expect(async () => {
      if ((await ghostCell()) === before) await page.keyboard.press(key);
      await expect.poll(ghostCell, { timeout: 1_000 }).toBe(expected);
    }).toPass();
  }
  await page.keyboard.press("Space");
  await expect(live).toHaveText(`${title} posé ${cellText(at)}.`);
}

const times = (key: Arrow, n: number): Arrow[] => Array.from({ length: n }, () => key);

async function createDashboard(page: Page) {
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle page" });
  const name = dialog.getByLabel("Nom", { exact: true });
  const create = dialog.getByRole("button", { name: "Créer la page" });
  await expect(async () => {
    if ((await name.inputValue()) === "") await name.fill("Tableau de bord");
    await expect(create).toBeEnabled({ timeout: 500 });
  }).toPass();
  await create.click();
  await expect(dialog).toBeHidden();
}

async function editLayout(page: Page) {
  await page.getByRole("button", { name: "Modifier la disposition" }).click();
  await expect(toolbar(page)).toBeVisible();
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(toolbar(page)).toHaveCount(0);
}

async function cancelWithEscape(page: Page) {
  await expect(async () => {
    if ((await toolbar(page).count()) > 0) await page.keyboard.press("Escape");
    await expect(toolbar(page)).toHaveCount(0, { timeout: 500 });
  }).toPass();
}

async function saveAfterDrag(page: Page) {
  const button = page.getByRole("button", { name: "Enregistrer" });
  await expect(async () => {
    if ((await button.count()) > 0 && (await button.isEnabled({ timeout: 100 })))
      await button.click({ timeout: 500 });
    await expect(toolbar(page)).toHaveCount(0, { timeout: 1_000 });
  }).toPass();
}

async function openSecondEditor(browser: Browser, first: Page, colorScheme: "dark" | "light"): Promise<Page> {
  const context = await browser.newContext({
    baseURL: new URL(first.url()).origin,
    colorScheme,
    viewport: TALL,
  });
  const second = await context.newPage();
  await second.goto(`/#pair=${E2E_TOKEN}`);
  await expect(second.getByRole("button", { name: "Nouveau projet" }).first()).toBeVisible();
  await second.goto(new URL(first.url()).hash);
  await expect(second.getByRole("button", { name: "Modifier la disposition" })).toBeVisible();
  return second;
}

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

test.describe("fenêtre large", () => {
  test.use({ viewport: WIDE });

  test("formats et disposition d'un tableau de bord", async ({ page }, info) => {
    await pairAndCreateProject(page, info, "LAY");
    await createDashboard(page);
    await addComponent(page, "Kanban");
    await addComponent(page, "Tickets");
    await expectLayout(widget(page, "Kanban"), "0,0,6,6");
    await expectLayout(widget(page, "Tickets"), "6,0,6,3");

    await editLayout(page);
    await expect(toolbar(page)).toContainText("Aucun changement");
    await page.getByRole("button", { name: "Format de Tickets" }).click();
    await expect(page.getByRole("menuitemradio", { name: /Moyen · 6 × 3/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const half = page.getByRole("menuitemradio", { name: /Demi-page · 12 × 6/ });
    await expect(half).toContainText("(Pas de place)");
    await expect(half).toHaveAttribute("aria-disabled", "true");
    await shot(page, info, "ecran-128");
    await page.getByRole("menuitemradio", { name: /Large · 6 × 6/ }).click();
    await expectLayout(widget(page, "Tickets"), "6,0,6,6");

    const handle = page.getByRole("button", { name: "Déplacer Kanban" });
    const box = await handle.boundingBox();
    if (!box) throw new Error("no handle");
    await page.mouse.move(box.x + 20, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 10 + 96 * 4, { steps: 12 });
    await shot(page, info, "ecran-127");
    await page.mouse.up();
    await expectLayout(widget(page, "Kanban"), "0,4,6,6");
    await expect(toolbar(page)).toContainText("2 changements");
    await saveAfterDrag(page);
    await page.reload();
    await expectLayout(widget(page, "Kanban"), "0,4,6,6");
    await expectLayout(widget(page, "Tickets"), "6,0,6,6");

    await editLayout(page);
    await moveByKeyboard(page, "Tickets", { x: 6, y: 0 }, times("ArrowDown", 2));
    await expectLayout(widget(page, "Tickets"), "6,2,6,6");
    await expect(toolbar(page)).toContainText("1 changement");
    await cancelWithEscape(page);
    await expectLayout(widget(page, "Tickets"), "6,0,6,6");

    await page.setViewportSize({ width: 900, height: 900 });
    await expect(page.getByRole("button", { name: "Modifier la disposition" })).toHaveCount(0);
    await expect(page.getByText("Élargis la fenêtre pour modifier la disposition.")).toBeVisible();
    await expectLayout(widget(page, "Kanban"), null);
    expect(await layoutOf(widget(page, "Tickets"))).toBeNull();
    const tickets = await widget(page, "Tickets").boundingBox();
    const kanban = await widget(page, "Kanban").boundingBox();
    expect(tickets && kanban && tickets.y < kanban.y).toBe(true);
    await shot(page, info, "ecran-129");
  });
});

test.describe("deux éditeurs", () => {
  test.use({ viewport: TALL });

  test("dernier écrit, chevauchement et hors grille refusés", async ({ page, browser }, info) => {
    await pairAndCreateProject(page, info, "LDE");
    await createDashboard(page);
    await addComponent(page, "Kanban");
    await addComponent(page, "Tickets");
    await expectLayout(widget(page, "Tickets"), "6,0,6,3");
    const other = await openSecondEditor(
      browser,
      page,
      info.project.name.endsWith("light") ? "light" : "dark",
    );
    const editors = [page, other];

    for (const editor of editors) await editLayout(editor);
    await page.getByRole("button", { name: "Format de Tickets" }).click();
    await page.getByRole("menuitemradio", { name: /Large · 6 × 6/ }).click();
    await expectLayout(widget(page, "Tickets"), "6,0,6,6");
    await save(page);
    await moveByKeyboard(other, "Tickets", { x: 6, y: 0 }, times("ArrowDown", 3));
    await expect(toolbar(other)).toContainText("1 changement");
    await save(other);
    for (const editor of editors) await expectLayout(widget(editor, "Tickets"), "6,3,6,3");

    for (const editor of editors) await editLayout(editor);
    await moveByKeyboard(page, "Tickets", { x: 6, y: 3 }, [
      ...times("ArrowLeft", 6),
      ...times("ArrowDown", 3),
    ]);
    await save(page);
    await moveByKeyboard(other, "Kanban", { x: 0, y: 0 }, times("ArrowDown", 3));
    await other.getByRole("button", { name: "Enregistrer" }).click();
    await expect(other.getByRole("alert")).toContainText("La disposition de Kanban n'a pas été enregistrée.");
    await expect(toolbar(other)).toContainText("1 changement");
    await cancelWithEscape(other);
    for (const editor of editors) {
      await expectLayout(widget(editor, "Kanban"), "0,0,6,6");
      await expectLayout(widget(editor, "Tickets"), "0,6,6,3");
    }

    const instanceId = await widget(page, "Tickets").getAttribute("data-instance");
    const setLayout = (layout: Box) =>
      rpc(page, {
        method: "command",
        projectId: projectIdOf(page),
        command: { method: "setInstanceLayout", instanceId, layout },
      });
    await expect(setLayout({ x: 8, y: 0, w: 6, h: 3 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(setLayout({ x: 6, y: 0, w: 5, h: 5 })).rejects.toThrow(/INVALID_INPUT/);
    await page.reload();
    await expectLayout(widget(page, "Tickets"), "0,6,6,3");
    await other.context().close();
  });
});
