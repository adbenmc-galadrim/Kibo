import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";

const HEIGHT = PIXEL_HEIGHTS.graphe;

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
    outDir: screensDir("2026-10-20-p30"),
    contentInformative: true,
  });
});
