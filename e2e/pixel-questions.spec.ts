import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, screensDir, settlePointer } from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";
import { leaveAndResetTabs } from "./pixel-tabs";

const HEIGHT = PIXEL_HEIGHTS.questions;
const OUT_DIR = screensDir("2026-10-31-p34-t12");
const Q14 = "Un box réaffecté garde-t-il ses photos ?";
const Q16 = "Quota par client : 2 Go ou 5 Go ?";

async function undoExport(page: Page, count: string): Promise<void> {
  const toast = page.getByRole("status", { name: count });
  if ((await toast.count()) === 0) return;
  await toast.getByRole("button", { name: "Annuler" }).click();
  await expect(toast).toBeHidden();
}

async function openQuestions(page: Page): Promise<void> {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Questions"), HEIGHT);
  await expect(page.getByText(Q14)).toBeVisible();
}

const measure = (page: Page, screen: string, reference: string) =>
  measureScreen(page, {
    screen,
    reference,
    height: HEIGHT,
    masks: PIXEL_MASKS.questions,
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: OUT_DIR,
    contentInformative: true,
  });

const expandRow = (page: Page, title: string) =>
  page.getByRole("article", { name: title }).getByRole("button", { name: title, exact: true }).click();

test("the compact list of Silo matches the mockup", async ({ page }) => {
  await openQuestions(page);
  await settlePointer(page, HEIGHT);
  try {
    await measure(page, "questions-liste", "p34-questions");
  } finally {
    await leaveAndResetTabs(page);
  }
});

test("an expanded row matches the mockup", async ({ page }) => {
  await openQuestions(page);
  await expandRow(page, Q14);
  await expect(page.getByRole("textbox", { name: "Votre réponse…" })).toBeVisible();
  await settlePointer(page, HEIGHT);
  try {
    await measure(page, "questions-depliee", "p34-questions-depliee");
  } finally {
    await leaveAndResetTabs(page);
  }
});

test("the title tooltip shows the whole question", async ({ page }, info) => {
  await openQuestions(page);
  await page.getByRole("article", { name: Q14 }).getByText(Q14).hover();
  await expect(page.getByRole("tooltip")).toContainText(Q14);
  try {
    const scheme = info.project.name.endsWith("-light") ? "light" : "dark";
    await page.screenshot({ path: join(OUT_DIR, `questions-infobulle-${scheme}.png`) });
  } finally {
    await leaveAndResetTabs(page);
  }
});

test("the row menu matches the mockup and exports one question", async ({ page }) => {
  await openQuestions(page);
  await expandRow(page, Q16);
  const row = page.getByRole("article", { name: Q16 });
  await row.getByRole("button", { name: /^Actions de / }).click();
  await expect(page.getByRole("menuitem", { name: "Modifier" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Archiver" }).hover();
  try {
    await measure(page, "questions-menu", "questions-menu");
    await page.getByRole("menuitem", { name: "Exporter cette question" }).click();
    await expect(page.getByText("Texte exporté")).toBeVisible();
    await expect(page.getByText(/^Questions pour /)).toContainText(Q16);
    await undoExport(page, "1 question marquée envoyée");
  } finally {
    await leaveAndResetTabs(page);
  }
});

test("the Questions of Silo, exported for the client, match the mockup on the whole screen", async ({
  page,
}) => {
  await openQuestions(page);
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
      outDir: OUT_DIR,
      contentInformative: true,
    });
  } finally {
    await undoExport(page, "2 questions marquées envoyées");
    await leaveAndResetTabs(page);
  }
});
