import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { SILO_GRAPHE_TITLE } from "./fixtures/silo-graphe";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";

const HEIGHT = PIXEL_HEIGHTS["attente-graphe"];

test("the Graphe of Silo with its steps on hold matches the mockup on the whole screen", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Graphe"), HEIGHT);
  await expect(page.getByText(SILO_GRAPHE_TITLE)).toBeVisible();
  await expect(page.getByRole("img", { name: "3 en attente" })).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "attente-graphe",
    height: HEIGHT,
    masks: PIXEL_MASKS["attente-graphe"],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-21-p31"),
    contentInformative: true,
  });
});
