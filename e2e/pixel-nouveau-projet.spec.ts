import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { openNewProject } from "./helpers";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";

const HEIGHT = PIXEL_HEIGHTS["nouveau-projet"];

test.use({ locale: "fr-FR", launchOptions: { args: ["--lang=fr-FR"] } });

test("the Nouveau projet dialog over the Vue d'ensemble matches the mockup on the whole screen", async ({
  page,
}) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Vue d'ensemble"), HEIGHT);
  await expect(page.getByText("2 sessions T3 Code")).toBeVisible();
  await page.getByRole("button", { name: /^Agent de projet/ }).click();
  await expect(page.getByRole("region", { name: "Lot n° 7" })).toBeVisible();
  await openNewProject(page);
  const dialog = page.getByRole("dialog", { name: "Nouveau projet" });
  await dialog.getByLabel("Nom", { exact: true }).fill("Silo");
  await dialog.getByLabel("Clé", { exact: true }).fill("SILO");
  await dialog.getByLabel("Client", { exact: true }).fill("Silo SA");
  await expect(dialog.getByLabel("Début du premier sprint")).toHaveValue("2026-10-19");
  await expect(dialog.getByText("6 sprints d'une semaine · du 19 oct. au 27 nov. 2026")).toBeVisible();
  await settlePointer(page, HEIGHT);
  try {
    await measureScreen(page, {
      screen: "nouveau-projet",
      height: HEIGHT,
      masks: PIXEL_MASKS["nouveau-projet"],
      content: contentBox(241, HEIGHT),
      root: (p) => p.locator("[data-view-body]"),
      outDir: screensDir("2026-10-18-p27-t20"),
      contentInformative: true,
    });
  } finally {
    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toBeHidden();
  }
});
