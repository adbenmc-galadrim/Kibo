import type { Locator, Page } from "@playwright/test";
import { compareToReference, stableCapture } from "./pixel-compare";
import { keepFiles, pixelSources, referenceName } from "./pixel-kit";
import type { PixelMask } from "./pixel-masks";
import { comparedReference, sourceReference } from "./pixel-reference";
import { type Box, diffReport } from "./pixel-report";
import { PIXEL_WIDTH } from "./pixel-settings";

export type ContentInput = {
  screen: string;
  scheme: "dark" | "light";
  height: number;
  region: Box;
  root: Locator;
  masks: readonly PixelMask[];
  outDir: string;
  reference?: string;
};
export type ContentResult = { ratio: number; diffPixels: number; boxes: Box[] };

async function placeShifted(page: Page, masks: readonly PixelMask[], dx: number, dy: number) {
  await page.evaluate(
    (list) => {
      for (const b of list) {
        const div = document.createElement("div");
        div.dataset.contentMask = "";
        div.style.cssText = `position:fixed;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;pointer-events:none`;
        document.body.append(div);
      }
    },
    masks.map((m) => ({ x: m.x + dx, y: m.y + dy, w: m.w, h: m.h })),
  );
  return masks.length === 0 ? [] : [page.locator("[data-content-mask]")];
}

const removeShifted = (page: Page) =>
  page.evaluate(() => {
    document.querySelectorAll("[data-content-mask]").forEach((el) => {
      el.remove();
    });
  });

export async function captureContent(page: Page, input: ContentInput): Promise<ContentResult> {
  const placed = await input.root.boundingBox();
  if (!placed) throw new Error("the content root is not on screen");
  const dx = Math.round(placed.x) - input.region.x;
  const dy = Math.round(placed.y) - input.region.y;
  await page.setViewportSize({ width: PIXEL_WIDTH + dx, height: input.height + dy });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const file = referenceName(input);
  const source = sourceReference(pixelSources(), file, { width: PIXEL_WIDTH, height: input.height });
  const reference = comparedReference(source, input.masks, input.region);
  const { x, y, w, h } = input.region;
  const clip = { x: x + dx, y: y + dy, width: w, height: h };
  const mask = await placeShifted(page, input.masks, dx, dy);
  try {
    const capture = await stableCapture(page, mask, clip);
    const name = `proposition-${input.screen}-contenu-${input.scheme}.png`;
    const { diff } = await compareToReference(name, capture, reference);
    keepFiles(input.outDir, `${input.screen}-contenu-${input.scheme}`, { capture, reference, diff });
    if (diff === null) return { ratio: 0, diffPixels: 0, boxes: [] };
    const report = diffReport(diff);
    return { ratio: report.ratio, diffPixels: report.diffPixels, boxes: report.boxes };
  } finally {
    await removeShifted(page);
  }
}
