import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { emisPageUrl } from "./pixel-emis";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";

const HEIGHT = PIXEL_HEIGHTS["fiche-ticket"];

test("the sheet of EMIS-45 opened from the Kanban matches the mockup on the whole screen", async ({
  page,
}) => {
  await pairBrowser(page);
  await openPixelPage(page, await emisPageUrl(page, "Kanban"), HEIGHT);
  await page.getByText("Conflits de saisie", { exact: true }).click();
  const sheet = page.getByRole("dialog", { name: /Conflits de saisie/ });
  await expect(sheet.getByRole("heading", { name: "Conflits de saisie" })).toBeVisible();
  await expect(sheet.getByText("changements demandés").first()).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "fiche-ticket",
    height: HEIGHT,
    masks: PIXEL_MASKS["fiche-ticket"],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-18-p27-t20"),
    contentInformative: true,
  });
});
