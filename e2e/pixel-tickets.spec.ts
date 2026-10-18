import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";

const HEIGHT = 1000;

test("the Tickets page of Silo on sprint S42 matches the mockup on the whole screen", async ({ page }) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Tickets"), HEIGHT);
  const s42 = page.getByRole("tablist", { name: "Sprint affiché" }).getByRole("tab", { name: /S42$/ });
  await expect(s42).toBeVisible();
  if ((await s42.getAttribute("aria-selected")) !== "true") await s42.click();
  await expect(s42).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Écran d'envoi hors ligne")).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "tickets",
    height: HEIGHT,
    masks: PIXEL_MASKS.tickets,
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-17-t16"),
  });
});
