import { test } from "@playwright/test";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, screensDir, settlePointer } from "./pixel-screen";
import { PIXEL_WIDTH } from "./pixel-settings";
import { openSiloOverviewAgent } from "./pixel-silo";

const HEIGHT = PIXEL_HEIGHTS["vue-ensemble"];

test("the Vue d'ensemble of Silo with the tracking panel open matches the mockup on the whole screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: HEIGHT });
  await openSiloOverviewAgent(page, HEIGHT);
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "vue-ensemble",
    reference: "p34-vue-ensemble-livree",
    height: HEIGHT,
    masks: PIXEL_MASKS["vue-ensemble"],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-31-p34-t8"),
    contentInformative: true,
  });
});
