import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { PIXEL_HEIGHTS } from "./pixel-masks";
import {
  contentBox,
  measureScreen,
  openPixelPage,
  type Phase,
  screensDir,
  settlePointer,
} from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";

const HEIGHT = PIXEL_HEIGHTS["fiche-ticket"];
const SCREENS = "2026-10-31-p34-t7";

async function openSheet(page: Page) {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Kanban"), HEIGHT);
  await page.getByText("Conflits de saisie", { exact: true }).click();
  const sheet = page.getByRole("dialog", { name: /Conflits de saisie/ });
  await expect(sheet.getByRole("heading", { name: "Conflits de saisie" })).toBeVisible();
  await expect(sheet.getByText("changements demandés").first()).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Lancer dans T3" })).toBeEnabled();
  await settlePointer(page, HEIGHT);
  return sheet;
}

const measure = (page: Page, screen: string, pose?: (page: Page, phase: Phase) => Promise<void>) =>
  measureScreen(page, {
    screen,
    height: HEIGHT,
    masks: [],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir(SCREENS),
    contentInformative: true,
    ...(pose && { pose }),
  });

test("the sheet of SILO-45 opened from the Kanban matches the mockup on the whole screen", async ({
  page,
}) => {
  await openSheet(page);
  await measure(page, "p34-fiche-ticket");
});

test("the launch confirmation shows the exact command and matches the mockup", async ({ page }) => {
  const sheet = await openSheet(page);
  await sheet.getByRole("button", { name: "Lancer dans T3" }).click();
  const dialog = page.getByRole("dialog", { name: "Lancer SILO-45 dans T3" });
  await expect(dialog.getByText(/^t3 thread start .* "\/full-delivery SILO-45"$/)).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measure(page, "p34-fiche-confirmation");
});

test("the copied key matches the mockup", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const sheet = await openSheet(page);
  await measure(page, "p34-fiche-copiee", async (p) => {
    await sheet.getByRole("button", { name: "Copier SILO-45" }).click();
    await expect(sheet.getByText("Copiée")).toBeVisible();
    await settlePointer(p, HEIGHT);
  });
});
