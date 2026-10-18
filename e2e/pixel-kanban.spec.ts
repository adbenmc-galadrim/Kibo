import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { emisPageUrl } from "./pixel-emis";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";

const HEIGHT = PIXEL_HEIGHTS.kanban;

test("the Kanban of Emis on « Tous » matches the mockup on the whole screen", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await emisPageUrl(page, "Kanban"), HEIGHT);
  const all = page.getByRole("radio", { name: /^Tous/ });
  await expect(all).toBeChecked();
  await expect(page.getByText("Écran d'envoi hors ligne")).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "kanban",
    height: HEIGHT,
    masks: PIXEL_MASKS.kanban,
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-18-p27-t20"),
    contentInformative: true,
  });
});
