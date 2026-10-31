import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { ATTENTE_SCREENS_DIR } from "./attente-kit";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import {
  contentBox,
  measureScreen,
  openPixelPage,
  type Phase,
  schemeOf,
  screensDir,
  settlePointer,
} from "./pixel-screen";
import { PIXEL_WIDTH } from "./pixel-settings";
import { openSiloOverviewAgent, siloComponentUrl, siloFeatureUrl, siloPageUrl } from "./pixel-silo";

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
  await openSiloOverviewAgent(page, height);
  await expect(page.getByText("3 en attente", { exact: true })).toBeVisible();
  await expect(page.getByText("Étape suivante")).toHaveCount(0);
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
  await expect(page.getByRole("region", { name: "En attente (3)" })).toBeVisible();
  await expect(page.getByText("livrée · 1 en attente", { exact: true })).toBeVisible();
  await expect(page.getByText(/ne tiendra pas/)).toHaveCount(0);
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

test("the band En attente of the Planning stays folded after a reload", async ({ page }, info) => {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: PLANNING_HEIGHT });
  await pairBrowser(page);
  await openPixelPage(page, await siloComponentUrl(page, "planning@1.0.0"), PLANNING_HEIGHT);
  const band = page.getByRole("region", { name: "En attente (3)" });
  await band.getByRole("button", { name: "Replier" }).click();
  await expect(band.getByRole("article")).toHaveCount(0);
  await page.reload();
  await expect(band.getByRole("button", { name: "Déplier" })).toBeVisible();
  await expect(band.getByRole("article")).toHaveCount(0);
  const scheme = info.project.name.endsWith("light") ? "light" : "dark";
  await page.screenshot({ path: join(OUT, `attente-planning-repliee-${scheme}.png`) });
  await band.getByRole("button", { name: "Déplier" }).click();
  await expect(band.getByRole("article")).toHaveCount(3);
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
  await expect(page.getByText("En attente · 3", { exact: true })).toBeVisible();
  await expect(page.getByText(/ne tiendra pas/)).toHaveCount(0);
  await measureScreen(page, {
    screen: "attente-fonctionnalite",
    height,
    masks: PIXEL_MASKS["attente-fonctionnalite"],
    content: contentBox(241, height),
    root: (p) => p.locator('[data-screen="feature"]'),
    outDir: OUT,
  });
});

const KANBAN_OUT = screensDir("2026-10-31-p34-t11");
const KANBAN_HEIGHT = PIXEL_HEIGHTS["attente-kanban"];

async function openKanban(page: Page): Promise<void> {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Kanban"), KANBAN_HEIGHT);
  await expect(page.getByRole("button", { name: "Tous", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("Écran d'envoi hors ligne")).toBeVisible();
  await expect(page.getByRole("button", { name: /^En attente/ })).toBeVisible();
}

const kanbanRun = {
  height: KANBAN_HEIGHT,
  masks: PIXEL_MASKS["attente-kanban"],
  content: contentBox(241, KANBAN_HEIGHT),
  root: (p: Page) => p.locator("[data-view-body]"),
  outDir: KANBAN_OUT,
  contentInformative: true,
};

test("the Kanban of Silo with its empty column folded matches the mockup on the whole screen", async ({
  page,
}) => {
  await openKanban(page);
  await expect(page.getByRole("region", { name: "Backlog" })).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByText("41 tickets", { exact: true })).toBeVisible();
  await settlePointer(page, KANBAN_HEIGHT);
  await measureScreen(page, { ...kanbanRun, screen: "attente-kanban", reference: "p34-kanban-replie" });
});

test("the tooltip of a card matches the mockup on the whole screen", async ({ page }) => {
  await openKanban(page);
  const pose = async () => {
    await page.getByRole("article", { name: /SILO-33/ }).hover();
    await expect(page.locator('[data-slot="tooltip-rows"]')).toBeVisible();
  };
  await measureScreen(page, {
    ...kanbanRun,
    screen: "p34-kanban-infobulle",
    pose,
    release: () => settlePointer(page, KANBAN_HEIGHT),
  });
});

test("a card dragged over a folded column unfolds it, and whole cards are counted", async ({
  page,
}, info) => {
  await openKanban(page);
  const whole = (name: string) =>
    page.getByRole("region", { name }).evaluate((column) => {
      const list = column.querySelector("[data-slot=kanban-cards]")?.getBoundingClientRect();
      if (!list) return 0;
      return Array.from(column.querySelectorAll("article")).filter(
        (a) => a.getBoundingClientRect().bottom <= list.bottom,
      ).length;
    });
  await page.setViewportSize({ width: PIXEL_WIDTH, height: 900 });
  console.log(
    `[kanban] cartes entières : À faire ${await whole("À faire")}, Bloqué ${await whole("Bloqué")}`,
  );
  await page.setViewportSize({ width: PIXEL_WIDTH, height: KANBAN_HEIGHT });
  const card = await page.getByRole("article", { name: /SILO-46/ }).boundingBox();
  const band = await page.getByRole("region", { name: "Backlog" }).boundingBox();
  if (!card || !band) throw new Error("the card or the band is not on screen");
  await page.mouse.move(card.x + 20, card.y + 20);
  await page.mouse.down();
  await page.mouse.move(card.x + 10, card.y + 30, { steps: 4 });
  await page.mouse.move(band.x + 20, band.y + 200, { steps: 12 });
  const backlog = page.getByRole("region", { name: "Backlog" });
  await expect(backlog).not.toHaveAttribute("data-collapsed", "true");
  await page.screenshot({ path: `${KANBAN_OUT}/kanban-glisser-${schemeOf(info.project.name)}.png` });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(backlog).toHaveAttribute("data-collapsed", "true");
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
  await expect(
    sheet.getByText("En attente · Règle de fusion à valider par le client · depuis le 16 oct."),
  ).toBeVisible();
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
