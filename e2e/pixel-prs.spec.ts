import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";
import { PRS_SCREENS_DIR, prsCounter, selectPrs } from "./prs-kit";

const HEIGHT = PIXEL_HEIGHTS["graphe-prs"];

test("the PRs view of the Silo Graphe matches the mockup on the whole screen", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Graphe"), HEIGHT);
  await selectPrs(page);
  await expect.soft(prsCounter(page)).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "graphe-prs",
    height: HEIGHT,
    masks: PIXEL_MASKS["graphe-prs"],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir(PRS_SCREENS_DIR),
  });
});
