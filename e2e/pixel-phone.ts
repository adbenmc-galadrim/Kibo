import { type Page, test } from "@playwright/test";
import { compareToReference, stableCapture } from "./pixel-compare";
import { keepFiles, pixelSources } from "./pixel-kit";
import type { PixelMask } from "./pixel-masks";
import { comparedReference, sourceReference } from "./pixel-reference";
import { diffReport } from "./pixel-report";
import { screensDir } from "./pixel-screen";

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const PHONE_SCALE = 2;

export const IPHONE_SAFE_AREA = { top: 47, bottom: 34, left: 0, right: 0 };

export const MOCKUP_MASKS: readonly PixelMask[] = [
  { x: 0, y: 0, w: PHONE_WIDTH, h: 47, why: "barre d'état d'iOS dessinée dans la maquette" },
  { x: 0, y: 810, w: PHONE_WIDTH, h: 34, why: "barre d'accueil d'iOS dessinée dans la maquette" },
];

export const SNAPSHOT_TIME_MASK: PixelMask = {
  x: 190,
  y: 104,
  w: 52,
  h: 26,
  why: "heure du dernier instantané, prise à l'horloge réelle du Mac",
};

const scaled = (masks: readonly PixelMask[]): PixelMask[] =>
  masks.map((m) => ({
    ...m,
    x: m.x * PHONE_SCALE,
    y: m.y * PHONE_SCALE,
    w: m.w * PHONE_SCALE,
    h: m.h * PHONE_SCALE,
  }));

export async function mockupRatio(page: Page, name: string, masks: readonly PixelMask[]): Promise<number> {
  const size = { width: PHONE_WIDTH * PHONE_SCALE, height: PHONE_HEIGHT * PHONE_SCALE };
  const reference = comparedReference(sourceReference(pixelSources(), name, size), scaled(masks));
  const capture = comparedReference(await stableCapture(page, []), scaled(masks));
  const { diff } = await compareToReference(name, capture, reference);
  keepFiles(screensDir("p35-telephone"), name.replace(/\.png$/, ""), { capture, reference, diff });
  const ratio = diff === null ? 0 : diffReport(diff).ratio;
  test.info().annotations.push({ type: "maquette", description: `${name} : ${(ratio * 100).toFixed(2)} %` });
  return ratio;
}
