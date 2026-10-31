import { expect, type Locator, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { PIXEL_HEIGHTS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";

const HEIGHT = PIXEL_HEIGHTS["fiche-ticket"];

async function measureThread(page: Page, title: string, badge: string, screen: string) {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Kanban"), HEIGHT);
  await page.getByText(title, { exact: true }).click();
  const sheet = page.getByRole("dialog", { name: new RegExp(title) });
  await expect(sheet.getByText(badge)).toBeVisible();
  await expect(sheet.getByRole("link", { name: "Ouvrir dans T3" })).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen,
    height: HEIGHT,
    masks: [],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-31-p34-t7"),
    contentInformative: true,
  });
}

test("a running thread replaces the button on the sheet and matches the mockup", async ({ page }) => {
  await measureThread(page, "Tests E2E de l'envoi", "T3 · en cours depuis 12 min", "p34-fiche-lancee");
});

test("a waiting thread turns amber on the sheet and matches the mockup", async ({ page }) => {
  await measureThread(page, "Conflits de saisie", "T3 · attend ta réponse", "p34-fiche-attend");
});

const OUT_DIR = screensDir("2026-10-31-p34-t13");

async function measureHover(page: Page, screen: string, hovered: Locator) {
  await measureScreen(page, {
    screen,
    height: HEIGHT,
    masks: [],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: OUT_DIR,
    contentInformative: true,
    pose: async () => {
      await hovered.hover();
      await expect(hovered.getByRole("button", { name: "Lancer dans T3" })).toBeVisible();
    },
    release: () => settlePointer(page, HEIGHT),
  });
}

test("the Kanban reveals Lancer dans T3 on hover and shows the T3 badge as in the mockup", async ({
  page,
}) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Kanban"), HEIGHT);
  await expect(page.getByText("T3 · en cours depuis 12 min")).toBeVisible();
  await measureHover(page, "p34-kanban-survol-t3", page.getByRole("article", { name: /^SILO-46 / }));
});

test("the Graphe reveals Lancer dans T3 on hover and shows the T3 pill as in the mockup", async ({
  page,
}) => {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Graphe"), PIXEL_HEIGHTS.graphe);
  await expect(page.getByRole("img", { name: "T3 · en cours depuis 12 min" })).toBeVisible();
  await measureHover(page, "p34-graphe-survol-t3", page.locator('li[data-startable="true"]').first());
});
