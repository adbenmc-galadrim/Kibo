import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { waitForEmisSeed } from "./emis-ready";
import { emisPageUrl } from "./pixel-emis";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { leaveAndResetTabs } from "./pixel-tabs";

const HEIGHT = PIXEL_HEIGHTS.questions;

async function undoExport(page: Page): Promise<void> {
  const toast = page.getByRole("status", { name: "2 questions marquées envoyées" });
  if ((await toast.count()) === 0) return;
  await toast.getByRole("button", { name: "Annuler" }).click();
  await expect(toast).toBeHidden();
}

test("the Questions of Emis, exported for the client, match the mockup on the whole screen", async ({
  page,
}) => {
  await pairBrowser(page);
  await waitForEmisSeed(page);
  await openPixelPage(page, await emisPageUrl(page, "Questions"), HEIGHT);
  await expect(page.getByText("Un ISO réaffecté garde-t-il ses photos ?")).toBeVisible();
  await page.getByRole("button", { name: /^Exporter pour / }).click();
  await expect(page.getByText("Texte exporté")).toBeVisible();
  await expect(page.getByRole("status", { name: "2 questions marquées envoyées" })).toBeVisible();
  await settlePointer(page, HEIGHT);
  try {
    await measureScreen(page, {
      screen: "questions",
      height: HEIGHT,
      masks: PIXEL_MASKS.questions,
      content: contentBox(241, HEIGHT),
      root: (p) => p.locator("[data-view-body]"),
      outDir: screensDir("2026-10-18-p27-t20"),
      contentInformative: true,
    });
  } finally {
    await undoExport(page);
    await leaveAndResetTabs(page);
  }
});
