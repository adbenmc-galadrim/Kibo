import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { captureContent } from "./pixel-content";
import { capturePixel, preparePixelPage, type Scheme } from "./pixel-kit";
import type { PixelMask } from "./pixel-masks";
import { type Box, regionRatio } from "./pixel-report";
import { PIXEL_SCREENSHOT, PIXEL_WIDTH } from "./pixel-settings";

export type Phase = "screen" | "content";
export type ScreenRun = {
  screen: string;
  height: number;
  masks: readonly PixelMask[];
  content: Box;
  root: (page: Page) => Locator;
  outDir: string;
  reference?: string;
  contentInformative?: boolean;
  pose?: (page: Page, phase: Phase) => Promise<void>;
  release?: (page: Page) => Promise<void>;
};

export const SCREENS_ROOT = join(import.meta.dirname, "..", "..", "..", "..", "screens");
export const screensDir = (folder: string): string =>
  process.env.KIBO_SCREENS_DIR ?? join(SCREENS_ROOT, folder);

export const contentBox = (left: number, height: number): Box => ({
  x: left,
  y: 49,
  w: PIXEL_WIDTH - left,
  h: height - 49,
});

export const schemeOf = (projectName: string): Scheme => (projectName.endsWith("-light") ? "light" : "dark");

const percent = (ratio: number): string => `${(ratio * 100).toFixed(3)} %`;

export async function openPixelPage(page: Page, url: string, height: number): Promise<void> {
  await preparePixelPage(page, { scheme: schemeOf(test.info().project.name), height });
  await page.goto(url);
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar.getByText("Galadrim", { exact: true })).toBeVisible();
  await expect(sidebar.getByText("Nimbus", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Synchronisé/).first()).toBeVisible();
}

export async function settlePointer(page: Page, height: number): Promise<void> {
  await page.mouse.move(0, height - 1);
  await page.evaluate(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined,
  );
}

export async function measureScreen(page: Page, run: ScreenRun): Promise<void> {
  const info = test.info();
  const scheme = schemeOf(info.project.name);
  const diffPath = join(run.outDir, `${run.screen}-${scheme}-diff.png`);
  rmSync(diffPath, { force: true });
  const input = {
    screen: run.screen,
    scheme,
    height: run.height,
    outDir: run.outDir,
    reference: run.reference,
  };
  await run.pose?.(page, "screen");
  let screenError: unknown = null;
  try {
    await capturePixel(page, { ...input, masks: run.masks });
  } catch (error) {
    screenError = error;
  }
  await run.release?.(page);
  const diff = existsSync(diffPath) ? readFileSync(diffPath) : null;
  if (screenError !== null && diff === null) throw screenError;
  const whole = regionRatio(diff, { x: 0, y: 0, w: PIXEL_WIDTH, h: run.height });
  const shell = regionRatio(diff, run.content);
  await run.pose?.(page, "content");
  const shot = await captureContent(page, {
    ...input,
    region: run.content,
    root: run.root(page),
    masks: run.masks,
  });
  await run.release?.(page);
  const zones = [...shot.boxes]
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, 15)
    .map((b) => `x=${b.x + run.content.x} y=${b.y + run.content.y} ${b.w}×${b.h}`);
  console.log(`[pixel] zones du contenu : ${zones.join(" ; ")}`);
  const line = `${scheme} : écran ${percent(whole)} (zone de contenu en place ${percent(shell)}), contenu recalé ${percent(shot.ratio)}`;
  info.annotations.push({ type: "pixel", description: line });
  console.log(`[pixel] ${run.screen}-${line}`);
  expect(whole).toBeLessThanOrEqual(PIXEL_SCREENSHOT.maxDiffPixelRatio);
  if (run.contentInformative !== true)
    expect(shot.ratio).toBeLessThanOrEqual(PIXEL_SCREENSHOT.maxDiffPixelRatio);
  if (screenError !== null) throw screenError;
}
