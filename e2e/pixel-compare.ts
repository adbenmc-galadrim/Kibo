import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { MASK_COLOR } from "./pixel-masks";
import { assertComparedAgainst } from "./pixel-reference";

const STABLE_TRIES = 20;
const STABLE_PAUSE_MS = 150;

export type Clip = { x: number; y: number; width: number; height: number };
export type Comparison = { diff: Uint8Array | null };

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

export async function stableCapture(page: Page, mask: Locator[], clip?: Clip): Promise<Uint8Array> {
  const shoot = () =>
    page.screenshot({ animations: "disabled", caret: "hide", mask, maskColor: MASK_COLOR, clip });
  let previous = await shoot();
  for (let k = 0; k < STABLE_TRIES; k++) {
    await page.waitForTimeout(STABLE_PAUSE_MS);
    const next = await shoot();
    if (sameBytes(previous, next)) return next;
    previous = next;
  }
  throw new Error(`the page did not settle: ${STABLE_TRIES + 1} captures in a row differ`);
}

export function writeComparedReference(name: string, reference: Uint8Array): string {
  const path = test.info().snapshotPath(name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, reference);
  return path;
}

export async function compareToReference(
  name: string,
  capture: Uint8Array,
  reference: Uint8Array,
): Promise<Comparison> {
  writeComparedReference(name, reference);
  const since = test.info().attachments.length;
  try {
    expect(Buffer.from(capture)).toMatchSnapshot(name, { threshold: 0.3, maxDiffPixels: 0 });
    return { diff: null };
  } catch (error) {
    const attachments = test.info().attachments.slice(since);
    assertComparedAgainst(attachments, reference);
    const diff = attachments.find((a) => a.name.endsWith("-diff.png"));
    if (diff?.path === undefined) throw error;
    return { diff: readFileSync(diff.path) };
  }
}
