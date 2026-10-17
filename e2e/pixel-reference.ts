import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MASK_RGB, type PixelMask } from "./pixel-masks";
import { encodePng, paintBoxes } from "./pixel-paint";
import { type Box, decodePng, pngSize, type Rgba } from "./pixel-report";

export type Attachment = { name: string; path?: string; body?: Uint8Array };

export function sourceReference(folder: string, name: string, size: { width: number; height: number }) {
  const path = join(folder, name);
  if (!existsSync(path)) throw new Error(`pixel reference missing: ${path}`);
  const png = readFileSync(path);
  const found = pngSize(png);
  if (found.width !== size.width || found.height !== size.height)
    throw new Error(
      `pixel reference ${name} is ${found.width}×${found.height}, capture is ${size.width}×${size.height}`,
    );
  return png;
}

export function cropImage(image: Rgba, box: Box): Rgba {
  const data = new Uint8Array(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const from = ((box.y + y) * image.width + box.x) * 4;
    data.set(image.data.subarray(from, from + box.w * 4), y * box.w * 4);
  }
  return { width: box.w, height: box.h, data };
}

const shiftedBoxes = (masks: readonly PixelMask[], region: Box): Box[] =>
  masks.map((m) => ({ x: m.x - region.x, y: m.y - region.y, w: m.w, h: m.h }));

export function comparedReference(
  source: Uint8Array,
  masks: readonly PixelMask[],
  region: Box | null = null,
): Uint8Array {
  if (region === null && masks.length === 0) return source;
  const image = decodePng(source);
  const area = region ?? { x: 0, y: 0, w: image.width, h: image.height };
  return encodePng(paintBoxes(cropImage(image, area), shiftedBoxes(masks, area), MASK_RGB));
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

const bytesOf = (a: Attachment): Uint8Array | null =>
  a.body ?? (a.path !== undefined && existsSync(a.path) ? readFileSync(a.path) : null);

export function assertComparedAgainst(attachments: readonly Attachment[], reference: Uint8Array): void {
  const previous = attachments.find((a) => a.name.endsWith("-previous.png"));
  if (previous !== undefined)
    throw new Error(`the diff compares two captures (${previous.name}), not the capture and the mockup`);
  const expected = attachments.find((a) => a.name.endsWith("-expected.png"));
  if (expected === undefined) throw new Error("the comparison attached no expected image");
  const bytes = bytesOf(expected);
  if (bytes === null || !sameBytes(bytes, reference))
    throw new Error(`the compared reference ${expected.name} is not derived from the mockup`);
}
