import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { emisPageUrl } from "./pixel-emis";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { PIXEL_WIDTH } from "./pixel-settings";

const HEIGHT = PIXEL_HEIGHTS["vue-ensemble"];

test("the Vue d'ensemble of Emis with the tracking panel open matches the mockup on the whole screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: HEIGHT });
  await pairBrowser(page);
  await openPixelPage(page, await emisPageUrl(page, "Vue d'ensemble"), HEIGHT);
  await expect(page.getByText("2 sessions T3 Code")).toBeVisible();
  await page.getByRole("button", { name: /^Agent de projet/ }).click();
  await expect(page.getByRole("region", { name: "Lot n° 7" })).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "vue-ensemble",
    height: HEIGHT,
    masks: PIXEL_MASKS["vue-ensemble"],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-17-t16"),
    contentInformative: true,
  });
});
