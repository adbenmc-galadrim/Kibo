import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { capturePixel, preparePixelPage } from "./pixel-kit";
import { PIXEL_KIT_REFERENCES } from "./pixel-settings";

const HEIGHT = 300;
const SCREEN = "kit";
const REFERENCE = join(PIXEL_KIT_REFERENCES, `proposition-${SCREEN}-dark.png`);

type Square = { x: number; y: number; size: number };

const block = (s: Square, color: string) =>
  `<div style="position:absolute;left:${s.x}px;top:${s.y}px;width:${s.size}px;height:${s.size}px;background:${color}"></div>`;

const html = (extra: Square | null) =>
  [
    '<!doctype html><html><body style="margin:0;background:#18181b">',
    block({ x: 40, y: 40, size: 200 }, "#3f3f46"),
    extra === null ? "" : block(extra, "#f97316"),
    "</body></html>",
  ].join("");

async function openTestPage(page: Page, extra: Square | null, height = HEIGHT) {
  await preparePixelPage(page, { scheme: "dark", height });
  await page.route("**/pixel-kit-page", (route) =>
    route.fulfill({ contentType: "text/html", body: html(extra) }),
  );
  await page.goto("/pixel-kit-page");
}

async function writeReference(page: Page, extra: Square | null) {
  await openTestPage(page, extra);
  writeFileSync(REFERENCE, await page.screenshot({ animations: "disabled", caret: "hide" }));
}

const capture = (page: Page, height = HEIGHT) =>
  capturePixel(page, { screen: SCREEN, scheme: "dark", height, outDir: test.info().outputPath("screens") });

const kept = (suffix: string) => existsSync(test.info().outputPath("screens", `${SCREEN}-dark${suffix}.png`));

test.beforeEach(async ({ page }) => {
  rmSync(PIXEL_KIT_REFERENCES, { recursive: true, force: true });
  mkdirSync(PIXEL_KIT_REFERENCES, { recursive: true });
  await pairBrowser(page);
});

test.afterAll(() => rmSync(PIXEL_KIT_REFERENCES, { recursive: true, force: true }));

test("an identical screen passes and keeps the capture next to the reference", async ({ page }) => {
  await writeReference(page, null);
  await openTestPage(page, null);
  const result = await capture(page);
  expect(result.report.diffPixels).toBe(0);
  expect(result.diffPath).toBeNull();
  expect(kept("")).toBe(true);
  expect(kept("-reference")).toBe(true);
});

test("a small difference passes but still yields the diff image and its zone", async ({ page }) => {
  await writeReference(page, null);
  await openTestPage(page, { x: 600, y: 100, size: 20 });
  const result = await capture(page);
  expect(result.report.boxes).toEqual([{ x: 600, y: 100, w: 20, h: 20 }]);
  expect(result.report.diffPixels).toBe(400);
  expect(kept("-diff")).toBe(true);
});

test("a difference above the threshold fails and lists the zone", async ({ page }) => {
  await writeReference(page, { x: 400, y: 80, size: 120 });
  await openTestPage(page, null);
  await expect(capture(page)).rejects.toThrow(/x=400 y=80 120×120/);
  expect(kept("-diff")).toBe(true);
  expect(kept("")).toBe(true);
});

test("a capture whose size differs from the reference is refused", async ({ page }) => {
  await writeReference(page, null);
  await openTestPage(page, null, 400);
  await expect(capture(page, 400)).rejects.toThrow("is 1440×300, capture is 1440×400");
});
