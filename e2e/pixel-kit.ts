import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expect, type Locator, type Page, type PageScreenshotOptions, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { MASK_COLOR, MASK_RGB, masksOf, type PixelMask } from "./pixel-masks";
import { encodePng, paintBoxes } from "./pixel-paint";
import { type DiffReport, decodePng, diffReport, formatReport, pngSize } from "./pixel-report";
import { assertFixedNow, FIXED_NOW, PIXEL_SCREENSHOT, PIXEL_WIDTH } from "./pixel-settings";

export type Scheme = "dark" | "light";
export type PixelInput = {
  screen: string;
  scheme: Scheme;
  height: number;
  outDir: string;
  masks?: readonly PixelMask[];
};
export type PixelResult = { report: DiffReport; diffPath: string | null };

const STRICT_TIMEOUT_MS = 3_000;

export async function preparePixelPage(page: Page, input: { scheme: Scheme; height: number }): Promise<void> {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: input.height });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ colorScheme: input.scheme, reducedMotion: "reduce" });
}

const referenceName = (input: Pick<PixelInput, "screen" | "scheme">): string =>
  `proposition-${input.screen}-${input.scheme}.png`;

function sourceReference(name: string, height: number): Uint8Array {
  const sources = test.info().project.metadata.pixelSources;
  if (typeof sources !== "string") throw new Error("the pixel project names no reference folder");
  const path = join(sources, name);
  if (!existsSync(path)) throw new Error(`pixel reference missing: ${path}`);
  const png = readFileSync(path);
  const size = pngSize(png);
  if (size.width !== PIXEL_WIDTH || size.height !== height)
    throw new Error(
      `pixel reference ${name} is ${size.width}×${size.height}, capture is ${PIXEL_WIDTH}×${height}`,
    );
  return png;
}

function comparedReference(name: string, source: Uint8Array, masks: readonly PixelMask[]): string {
  const path = test.info().snapshotPath(name, { kind: "screenshot" });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    masks.length === 0 ? source : encodePng(paintBoxes(decodePng(source), masks, MASK_RGB)),
  );
  return path;
}

async function placeMasks(page: Page, masks: readonly PixelMask[]): Promise<Locator[]> {
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

const removeMasks = (page: Page) =>
  page.evaluate(() => {
    document.querySelectorAll("[data-pixel-mask]").forEach((el) => {
      el.remove();
    });
  });

function lastAttachment(suffix: string, since: number): string | null {
  const recent = test.info().attachments.slice(since);
  const found = recent.reverse().find((a) => a.name.endsWith(suffix) && a.path !== undefined);
  return found?.path ?? null;
}

type Shot = { reference: string; mask: Locator[] };

async function keepFiles(
  page: Page,
  input: PixelInput,
  shot: Shot,
  diff: string | null,
): Promise<PixelResult> {
  const base = join(input.outDir, `${input.screen}-${input.scheme}`);
  mkdirSync(input.outDir, { recursive: true });
  const capture = await page.screenshot({ ...SHOT_OPTIONS, mask: shot.mask, maskColor: MASK_COLOR });
  writeFileSync(`${base}.png`, capture);
  const reference = shot.reference;
  copyFileSync(reference, `${base}-reference.png`);
  if (diff === null) return { report: identical(input.height), diffPath: null };
  copyFileSync(diff, `${base}-diff.png`);
  return { report: diffReport(readFileSync(diff)), diffPath: `${base}-diff.png` };
}

const identical = (height: number): DiffReport => ({
  width: PIXEL_WIDTH,
  height,
  diffPixels: 0,
  ratio: 0,
  boxes: [],
});

const SHOT_OPTIONS: PageScreenshotOptions = { animations: "disabled", caret: "hide" };

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function matchesExactly(page: Page, name: string, mask: Locator[]): Promise<boolean> {
  try {
    await expect(page).toHaveScreenshot(name, {
      ...PIXEL_SCREENSHOT,
      mask,
      maskColor: MASK_COLOR,
      maxDiffPixelRatio: 0,
      maxDiffPixels: 0,
      timeout: STRICT_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
}

export async function capturePixel(page: Page, input: PixelInput): Promise<PixelResult> {
  if (test.info().config.updateSnapshots !== "none")
    throw new Error("pixel references are read-only: run without --update-snapshots");
  assertFixedNow(await rpc(page, { method: "getAppInfo" }));
  await preparePixelPage(page, input);
  const name = referenceName(input);
  const masks = input.masks ?? masksOf(input.screen);
  const reference = comparedReference(name, sourceReference(name, input.height), masks);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const shot = { reference, mask: await placeMasks(page, masks) };
  try {
    return await compare(page, input, name, shot);
  } finally {
    await removeMasks(page);
  }
}

async function compare(page: Page, input: PixelInput, name: string, shot: Shot): Promise<PixelResult> {
  const since = test.info().attachments.length;
  try {
    await expect(page).toHaveScreenshot(name, {
      ...PIXEL_SCREENSHOT,
      mask: shot.mask,
      maskColor: MASK_COLOR,
    });
  } catch (error) {
    const kept = await keepFiles(page, input, shot, lastAttachment("-diff.png", since));
    const zones = kept.diffPath === null ? "no diff image" : formatReport(kept.report);
    throw new Error(`pixel mismatch on ${name}\n${zones}\nfiles: ${input.outDir}\n\n${errorMessage(error)}`);
  }
  const exact = await matchesExactly(page, name, shot.mask);
  return keepFiles(page, input, shot, exact ? null : lastAttachment("-diff.png", since));
}
