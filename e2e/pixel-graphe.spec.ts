import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { preparePixelPage } from "./pixel-kit";
import { GRAPHE_FOLDED_MASKS, PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import {
  contentBox,
  measureScreen,
  openPixelPage,
  schemeOf,
  screensDir,
  settlePointer,
} from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";

const HEIGHT = PIXEL_HEIGHTS.graphe;
const OUT_DIR = "2026-10-31-p34-t10";

test("the Graphe of Silo in sprint columns matches the mockup on the whole screen", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Graphe"), HEIGHT);
  await expect(page.getByText(/^9 fonctionnalités · /)).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "graphe",
    height: HEIGHT,
    masks: PIXEL_MASKS.graphe,
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir(OUT_DIR),
    contentInformative: true,
  });
});

test("« Tout voir » folds every frame as in the mockup", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Graphe"), HEIGHT);
  await page.getByRole("button", { name: "Tout voir" }).click();
  await expect(page.getByRole("button", { name: "Déplier tout" })).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "graphe-tout-voir",
    reference: "p34-graphe-tout-voir",
    height: HEIGHT,
    masks: GRAPHE_FOLDED_MASKS,
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir(OUT_DIR),
    contentInformative: true,
  });
});

test("one frame unfolded after « Tout voir » matches the mockup", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Graphe"), HEIGHT);
  await page.getByRole("button", { name: "Tout voir" }).click();
  await page.getByRole("article", { name: /^F5 / }).getByRole("button").click();
  await expect(page.getByRole("article", { name: /^F5 / }).getByRole("listitem")).toHaveCount(5);
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "graphe-redeplie",
    reference: "p34-graphe-redeplie",
    height: HEIGHT,
    masks: GRAPHE_FOLDED_MASKS,
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir(OUT_DIR),
    contentInformative: true,
  });
});

test("the lane headers stay in place while the canvas scrolls", async ({ page }) => {
  await pairBrowser(page);
  await preparePixelPage(page, { scheme: schemeOf(test.info().project.name), height: 420 });
  await page.goto(await siloPageUrl(page, "Graphe"));
  const lanes = page.getByRole("region", { name: "Fonctionnalités par sprint" });
  const header = lanes.locator("[data-slot='lane-header']").first();
  const before = await header.boundingBox();
  await lanes.evaluate((el) => el.scrollTo({ top: 200 }));
  await expect.poll(() => lanes.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect((await header.boundingBox())?.y).toBe(before?.y);
});

test("at the narrowest columns the folded canvas does not scroll sideways", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Graphe"), HEIGHT);
  await page.getByRole("button", { name: "Tout voir" }).click();
  await page.setViewportSize({ width: 48 + 5 * 132, height: HEIGHT });
  const lanes = page.getByRole("region", { name: "Fonctionnalités par sprint" });
  await expect.poll(() => lanes.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  const header = lanes.locator("[data-slot='lane-header']").first();
  await expect.poll(async () => (await header.boundingBox())?.width).toBe(132);
  await settlePointer(page, HEIGHT);
  const scheme = schemeOf(test.info().project.name);
  await page.screenshot({ path: join(screensDir(OUT_DIR), `graphe-132px-${scheme}.png`) });
});
