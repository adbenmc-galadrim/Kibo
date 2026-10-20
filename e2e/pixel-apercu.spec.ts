import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { SILO_APERCU_FRAME } from "./fixtures/silo-apercu";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { measureScreen, openPixelPage, schemeOf, screensDir, settlePointer } from "./pixel-screen";
import { PIXEL_WIDTH } from "./pixel-settings";
import { siloPageUrl } from "./pixel-silo";

const HEIGHT = PIXEL_HEIGHTS["apercu-maquette"];
const BAR = 40;
const SCREENS = screensDir("2026-10-20-p30");
const VIEWER = new RegExp(`^Aperçu de ${SILO_APERCU_FRAME.name}`);
const CADRE = readFileSync(join(import.meta.dirname, "..", SILO_APERCU_FRAME.png));

const naturalWidth = (img: Locator) =>
  img.evaluate((el) => (el instanceof HTMLImageElement && el.complete ? el.naturalWidth : 0));

async function openMockups(page: Page): Promise<Locator> {
  await page.getByText("Conflits de saisie", { exact: true }).click();
  const sheet = page.getByRole("dialog", { name: /Conflits de saisie/ });
  await sheet.getByRole("button", { name: "Maquettes" }).click();
  const section = sheet.getByRole("region", { name: "Maquettes" });
  await expect.poll(() => naturalWidth(section.getByRole("img", { name: SILO_APERCU_FRAME.name }))).toBe(444);
  return sheet;
}

async function captureSheet(page: Page, sheet: Locator): Promise<void> {
  await sheet.getByRole("textbox", { name: "Lier un cadre" }).scrollIntoViewIfNeeded();
  await settlePointer(page, HEIGHT);
  const scheme = schemeOf(test.info().project.name);
  await page.screenshot({ path: join(SCREENS, `t11-fiche-maquettes-${scheme}.png`), animations: "disabled" });
}

test("the mockup of SILO-45 in full screen matches P8g on the whole screen, without a mask", async ({
  page,
}) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Kanban"), HEIGHT);
  const sheet = await openMockups(page);
  await captureSheet(page, sheet);
  await sheet.getByRole("button", { name: "Plein écran", exact: true }).click();
  const view = page.getByRole("dialog", { name: SILO_APERCU_FRAME.name, exact: true });
  const frame = view.getByRole("img", { name: SILO_APERCU_FRAME.name });
  await expect.poll(() => naturalWidth(frame)).toBe(SILO_APERCU_FRAME.width);
  await expect.soft(view.getByText("100 %", { exact: true })).toBeVisible();
  const src = await frame.evaluate((el) => (el instanceof HTMLImageElement ? el.currentSrc : ""));
  const served = await page.request.get(src);
  expect(Buffer.from(await served.body()).equals(CADRE)).toBe(true);
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "apercu-maquette",
    height: HEIGHT,
    masks: PIXEL_MASKS["apercu-maquette"],
    content: { x: 0, y: BAR, w: PIXEL_WIDTH, h: HEIGHT - BAR },
    root: (p) => p.getByRole("group", { name: VIEWER }),
    outDir: SCREENS,
  });
});
