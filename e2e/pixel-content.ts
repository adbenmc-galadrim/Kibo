import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { MASK_COLOR, MASK_RGB, type PixelMask } from "./pixel-masks";
import { encodePng, paintBoxes } from "./pixel-paint";
import { type Box, decodePng, diffReport, type Rgba } from "./pixel-report";
import { DESIGN_REFERENCES, PIXEL_SCREENSHOT, PIXEL_WIDTH } from "./pixel-settings";

export type ContentInput = {
  screen: string;
  scheme: "dark" | "light";
  height: number;
  region: Box;
  root: Locator;
  masks: readonly PixelMask[];
  outDir: string;
};
export type ContentResult = { ratio: number; diffPixels: number; boxes: Box[] };

const STRICT_TIMEOUT_MS = 3_000;

function crop(image: Rgba, box: Box): Rgba {
  const data = new Uint8Array(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const from = ((box.y + y) * image.width + box.x) * 4;
    data.set(image.data.subarray(from, from + box.w * 4), y * box.w * 4);
  }
  return { width: box.w, height: box.h, data };
}

const shifted = (masks: readonly PixelMask[], dx: number, dy: number): Box[] =>
  masks.map((m) => ({ x: m.x + dx, y: m.y + dy, w: m.w, h: m.h }));

async function placeMasks(page: Page, boxes: readonly Box[]): Promise<Locator[]> {
  await page.evaluate((list) => {
    for (const b of list) {
      const div = document.createElement("div");
      div.dataset.contentMask = "";
      div.style.cssText = `position:fixed;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;pointer-events:none`;
      document.body.append(div);
    }
  }, boxes);
  return boxes.length === 0 ? [] : [page.locator("[data-content-mask]")];
}

function lastDiff(since: number): string | null {
  const recent = test.info().attachments.slice(since).reverse();
  return recent.find((a) => a.name.endsWith("-diff.png") && a.path !== undefined)?.path ?? null;
}

export async function captureContent(page: Page, input: ContentInput): Promise<ContentResult> {
  const placed = await input.root.boundingBox();
  if (!placed) throw new Error("the content root is not on screen");
  const dx = Math.round(placed.x) - input.region.x;
  const dy = Math.round(placed.y) - input.region.y;
  await page.setViewportSize({ width: PIXEL_WIDTH + dx, height: input.height + dy });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const name = `proposition-${input.screen}-contenu-${input.scheme}.png`;
  const source = decodePng(
    readFileSync(join(DESIGN_REFERENCES, `proposition-${input.screen}-${input.scheme}.png`)),
  );
  const reference = paintBoxes(
    crop(source, input.region),
    shifted(input.masks, -input.region.x, -input.region.y),
    MASK_RGB,
  );
  const referencePath = test.info().snapshotPath(name, { kind: "screenshot" });
  mkdirSync(dirname(referencePath), { recursive: true });
  writeFileSync(referencePath, encodePng(reference));
  const clip = {
    x: input.region.x + dx,
    y: input.region.y + dy,
    width: input.region.w,
    height: input.region.h,
  };
  const mask = await placeMasks(page, shifted(input.masks, dx, dy));
  const since = test.info().attachments.length;
  const base = join(input.outDir, `${input.screen}-contenu-${input.scheme}`);
  mkdirSync(input.outDir, { recursive: true });
  try {
    await expect(page).toHaveScreenshot(name, {
      ...PIXEL_SCREENSHOT,
      clip,
      mask,
      maskColor: MASK_COLOR,
      maxDiffPixelRatio: 0,
      maxDiffPixels: 0,
      timeout: STRICT_TIMEOUT_MS,
    });
  } catch {
    const diff = lastDiff(since);
    if (diff !== null) copyFileSync(diff, `${base}-diff.png`);
  }
  writeFileSync(
    `${base}.png`,
    await page.screenshot({ animations: "disabled", caret: "hide", clip, mask, maskColor: MASK_COLOR }),
  );
  copyFileSync(referencePath, `${base}-reference.png`);
  await page.evaluate(() => {
    document.querySelectorAll("[data-content-mask]").forEach((el) => {
      el.remove();
    });
  });
  const diff = lastDiff(since);
  if (diff === null) return { ratio: 0, diffPixels: 0, boxes: [] };
  const report = diffReport(readFileSync(diff));
  return { ratio: report.ratio, diffPixels: report.diffPixels, boxes: report.boxes };
}
