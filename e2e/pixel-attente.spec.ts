import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { ATTENTE_SCREENS_DIR } from "./attente-kit";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import {
  contentBox,
  measureScreen,
  openPixelPage,
  type Phase,
  screensDir,
  settlePointer,
} from "./pixel-screen";
import { PIXEL_WIDTH } from "./pixel-settings";
import { siloComponentUrl, siloFeatureUrl, siloPageUrl } from "./pixel-silo";

const OUT = screensDir(ATTENTE_SCREENS_DIR);
const DROP_INSET_X = 40;
const DROP_DOWN_Y = 221;

async function dragF9OverS44(page: Page): Promise<void> {
  const box = await page.getByRole("button", { name: /^F9 / }).boundingBox();
  const s44 = await page.getByRole("region", { name: /^S44 / }).boundingBox();
  if (!box || !s44) throw new Error("F9 card or S44 is not visible");
  const grab = { x: box.x + 10, y: box.y + box.height / 2 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 10, grab.y + 10, { steps: 4 });
  await page.mouse.move(s44.x + DROP_INSET_X, grab.y + DROP_DOWN_Y, { steps: 12 });
  await expect(page.getByText("Déposer pour planifier en S44")).toBeVisible();
}

async function cancelDrag(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByText("Déposer pour planifier en S44")).toBeHidden();
}

const PLANNING_HEIGHT = PIXEL_HEIGHTS["attente-planning"];
const PLANNING_CONTENT = contentBox(241, PLANNING_HEIGHT);

async function planningViewport(page: Page): Promise<void> {
  const placed = await page.locator("[data-view-body]").boundingBox();
  if (!placed) throw new Error("the content root is not on screen");
  await page.setViewportSize({
    width: PIXEL_WIDTH + Math.round(placed.x) - PLANNING_CONTENT.x,
    height: PLANNING_HEIGHT + Math.round(placed.y) - PLANNING_CONTENT.y,
  });
  await expect(page.getByRole("button", { name: /^F9 / })).toBeVisible();
}

async function posePlanning(page: Page, phase: Phase): Promise<void> {
  if (phase === "content") await planningViewport(page);
  await dragF9OverS44(page);
}

test("the Vue d'ensemble of Silo with three steps on hold matches the mockup on the whole screen", async ({
  page,
}) => {
  const height = PIXEL_HEIGHTS["attente-vue-ensemble"];
  await page.setViewportSize({ width: PIXEL_WIDTH, height });
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Vue d'ensemble"), height);
  await expect(page.getByText("2 sessions T3 Code")).toBeVisible();
  await page.getByRole("button", { name: /^Agent de projet/ }).click();
  await expect(page.getByRole("region", { name: "Lot n° 7" })).toBeVisible();
  await expect.soft(page.getByText("3 en attente", { exact: true })).toBeVisible();
  await settlePointer(page, height);
  await measureScreen(page, {
    screen: "attente-vue-ensemble",
    height,
    masks: PIXEL_MASKS["attente-vue-ensemble"],
    content: contentBox(241, height),
    root: (p) => p.locator("[data-view-body]"),
    outDir: OUT,
    contentInformative: true,
  });
});

test("the Planning of Silo with « En attente (3) », F9 dragged over S44, matches the mockup on the whole screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: PLANNING_HEIGHT });
  await pairBrowser(page);
  await openPixelPage(page, await siloComponentUrl(page, "planning@1.0.0"), PLANNING_HEIGHT);
  await expect(page.getByRole("region", { name: "S42 Saisie hors ligne" })).toBeVisible();
  await expect.soft(page.getByText("En attente (3)", { exact: true })).toBeVisible();
  await expect.soft(page.getByText("livrée · 1 en attente", { exact: true })).toBeVisible();
  await measureScreen(page, {
    screen: "attente-planning",
    height: PLANNING_HEIGHT,
    masks: PIXEL_MASKS["attente-planning"],
    content: PLANNING_CONTENT,
    root: (p) => p.locator("[data-view-body]"),
    outDir: OUT,
    pose: posePlanning,
    release: cancelDrag,
  });
});

test("the feature sheet of F5 with three steps on hold matches the mockup on the whole screen", async ({
  page,
}) => {
  const height = PIXEL_HEIGHTS["attente-fonctionnalite"];
  await pairBrowser(page);
  await openPixelPage(page, await siloFeatureUrl(page, "F5"), height);
  await expect(
    page.getByRole("heading", { level: 1, name: "Envoyer les photos d'un constat" }),
  ).toBeVisible();
  await expect.soft(page.getByText("En attente · 3", { exact: true })).toBeVisible();
  await measureScreen(page, {
    screen: "attente-fonctionnalite",
    height,
    masks: PIXEL_MASKS["attente-fonctionnalite"],
    content: contentBox(241, height),
    root: (p) => p.locator('[data-screen="feature"]'),
    outDir: OUT,
  });
});

test("the Kanban of Silo on « Tous » with the « En attente » filter matches the mockup on the whole screen", async ({
  page,
}) => {
  const height = PIXEL_HEIGHTS["attente-kanban"];
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Kanban"), height);
  const all = page.getByRole("button", { name: "Tous", exact: true });
  await expect(all).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Écran d'envoi hors ligne")).toBeVisible();
  await expect.soft(page.getByRole("button", { name: /^En attente/ })).toBeVisible();
  await settlePointer(page, height);
  await measureScreen(page, {
    screen: "attente-kanban",
    height,
    masks: PIXEL_MASKS["attente-kanban"],
    content: contentBox(241, height),
    root: (p) => p.locator("[data-view-body]"),
    outDir: OUT,
    contentInformative: true,
  });
});

test("the sheet of SILO-45 on hold opened from the Kanban matches the mockup on the whole screen", async ({
  page,
}) => {
  const height = PIXEL_HEIGHTS["attente-fiche-ticket"];
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Kanban"), height);
  await page.getByText("Conflits de saisie", { exact: true }).click();
  const sheet = page.getByRole("dialog", { name: /Conflits de saisie/ });
  await expect(sheet.getByRole("heading", { name: "Conflits de saisie" })).toBeVisible();
  await expect(sheet.getByText("changements demandés").first()).toBeVisible();
  await expect
    .soft(sheet.getByText("En attente · Règle de fusion à valider par le client · depuis le 16 oct."))
    .toBeVisible();
  await settlePointer(page, height);
  await measureScreen(page, {
    screen: "attente-fiche-ticket",
    height,
    masks: PIXEL_MASKS["attente-fiche-ticket"],
    content: contentBox(241, height),
    root: (p) => p.locator("[data-view-body]"),
    outDir: OUT,
    contentInformative: true,
  });
});
