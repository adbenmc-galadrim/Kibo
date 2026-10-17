import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Locator, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { compareToReference, stableCapture } from "./pixel-compare";
import { masksOf, type PixelMask, referenceOf } from "./pixel-masks";
import { comparedReference, sourceReference } from "./pixel-reference";
import { type DiffReport, diffReport, formatReport } from "./pixel-report";
import { assertFixedNow, FIXED_NOW, PIXEL_SCREENSHOT, PIXEL_WIDTH } from "./pixel-settings";

export type Scheme = "dark" | "light";
export type PixelInput = {
  screen: string;
  scheme: Scheme;
  height: number;
  outDir: string;
  masks?: readonly PixelMask[];
  reference?: string;
};
export type PixelResult = { report: DiffReport; diff: Uint8Array | null; diffPath: string | null };

export async function preparePixelPage(page: Page, input: { scheme: Scheme; height: number }): Promise<void> {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: input.height });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ colorScheme: input.scheme, reducedMotion: "reduce" });
}

export const referenceName = (input: Pick<PixelInput, "screen" | "scheme" | "reference">): string =>
  `proposition-${input.reference ?? referenceOf(input.screen)}-${input.scheme}.png`;

export function pixelSources(): string {
  const sources = test.info().project.metadata.pixelSources;
  if (typeof sources !== "string") throw new Error("the pixel project names no reference folder");
  return sources;
}

export async function placeMasks(page: Page, masks: readonly PixelMask[]): Promise<Locator[]> {
  await page.evaluate((boxes) => {
    for (const b of boxes) {
      const div = document.createElement("div");
      div.dataset.pixelMask = "";
      div.style.cssText = `position:fixed;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;pointer-events:none`;
      document.body.append(div);
    }
  }, masks);
  return masks.length === 0 ? [] : [page.locator("[data-pixel-mask]")];
}

export const removeMasks = (page: Page) =>
  page.evaluate(() => {
    document.querySelectorAll("[data-pixel-mask]").forEach((el) => {
      el.remove();
    });
  });

type Kept = { capture: Uint8Array; reference: Uint8Array; diff: Uint8Array | null };

export function keepFiles(outDir: string, base: string, kept: Kept): string | null {
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, base);
  writeFileSync(`${path}.png`, kept.capture);
  writeFileSync(`${path}-reference.png`, kept.reference);
  rmSync(`${path}-diff.png`, { force: true });
  if (kept.diff === null) return null;
  writeFileSync(`${path}-diff.png`, kept.diff);
  return `${path}-diff.png`;
}

const identical = (height: number): DiffReport => ({
  width: PIXEL_WIDTH,
  height,
  diffPixels: 0,
  ratio: 0,
  boxes: [],
});

export async function capturePixel(page: Page, input: PixelInput): Promise<PixelResult> {
  if (test.info().config.updateSnapshots !== "none")
    throw new Error("pixel references are read-only: run without --update-snapshots");
  assertFixedNow(await rpc(page, { method: "getAppInfo" }));
  await preparePixelPage(page, input);
  const name = referenceName(input);
  const masks = input.masks ?? masksOf(input.screen);
  const source = sourceReference(pixelSources(), name, { width: PIXEL_WIDTH, height: input.height });
  const reference = comparedReference(source, masks);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const mask = await placeMasks(page, masks);
  try {
    const capture = await stableCapture(page, mask);
    const { diff } = await compareToReference(name, capture, reference);
    const diffPath = keepFiles(input.outDir, `${input.screen}-${input.scheme}`, { capture, reference, diff });
    const report = diff === null ? identical(input.height) : diffReport(diff);
    if (report.ratio > PIXEL_SCREENSHOT.maxDiffPixelRatio)
      throw new Error(`pixel mismatch on ${name}\n${formatReport(report)}\nfiles: ${input.outDir}`);
    return { report, diff, diffPath };
  } finally {
    await removeMasks(page);
  }
}
