import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir } from "./pixel-screen";
import { siloFeatureUrl } from "./pixel-silo";

const HEIGHT = 1000;

test("the feature sheet of F5 opened in a tab matches the mockup on the whole screen", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloFeatureUrl(page, "F5"), HEIGHT);
  await expect(
    page.getByRole("heading", { level: 1, name: "Envoyer les photos d'un constat" }),
  ).toBeVisible();
  await measureScreen(page, {
    screen: "fonctionnalite",
    height: HEIGHT,
    masks: PIXEL_MASKS.fonctionnalite,
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator('[data-screen="feature"]'),
    outDir: screensDir("2026-10-17-t16"),
  });
});
