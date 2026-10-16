import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { type DiffReport, diffReport, formatReport, pngSize } from "./pixel-report";
import { assertFixedNow, FIXED_NOW, PIXEL_SCREENSHOT, PIXEL_WIDTH } from "./pixel-settings";

export type Scheme = "dark" | "light";
export type PixelInput = { screen: string; scheme: Scheme; height: number; outDir: string };
export type PixelResult = { report: DiffReport; diffPath: string | null };

const STRICT_TIMEOUT_MS = 3_000;

export async function preparePixelPage(page: Page, input: { scheme: Scheme; height: number }): Promise<void> {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: input.height });
  await page.clock.setFixedTime(FIXED_NOW);
  await page.emulateMedia({ colorScheme: input.scheme, reducedMotion: "reduce" });
}

const referenceName = (input: Pick<PixelInput, "screen" | "scheme">): string =>
  `proposition-${input.screen}-${input.scheme}.png`;

function assertReference(name: string, height: number): string {
  const path = test.info().snapshotPath(name, { kind: "screenshot" });
  if (!existsSync(path)) throw new Error(`pixel reference missing: ${path}`);
  const size = pngSize(readFileSync(path));
  if (size.width !== PIXEL_WIDTH || size.height !== height)
    throw new Error(
      `pixel reference ${name} is ${size.width}×${size.height}, capture is ${PIXEL_WIDTH}×${height}`,
    );
  return path;
}

function lastAttachment(suffix: string, since: number): string | null {
  const recent = test.info().attachments.slice(since);
  const found = recent.reverse().find((a) => a.name.endsWith(suffix) && a.path !== undefined);
  return found?.path ?? null;
}

async function keepFiles(
  page: Page,
  input: PixelInput,
  reference: string,
  diff: string | null,
): Promise<PixelResult> {
  const base = join(input.outDir, `${input.screen}-${input.scheme}`);
  mkdirSync(input.outDir, { recursive: true });
  writeFileSync(`${base}.png`, await page.screenshot({ animations: "disabled", caret: "hide" }));
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

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function matchesExactly(page: Page, name: string): Promise<boolean> {
  try {
    await expect(page).toHaveScreenshot(name, {
      ...PIXEL_SCREENSHOT,
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
  const reference = assertReference(name, input.height);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const since = test.info().attachments.length;
  try {
    await expect(page).toHaveScreenshot(name, PIXEL_SCREENSHOT);
  } catch (error) {
    const kept = await keepFiles(page, input, reference, lastAttachment("-diff.png", since));
    const zones = kept.diffPath === null ? "no diff image" : formatReport(kept.report);
    throw new Error(`pixel mismatch on ${name}\n${zones}\nfiles: ${input.outDir}\n\n${errorMessage(error)}`);
  }
  const exact = await matchesExactly(page, name);
  return keepFiles(page, input, reference, exact ? null : lastAttachment("-diff.png", since));
}
