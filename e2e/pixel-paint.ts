import { deflateSync } from "node:zlib";
import type { Box, Rgba } from "./pixel-report";

const SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const RGBA_COLOR_TYPE = 6;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function encodePng(image: Rgba): Uint8Array {
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, image.width);
  view.setUint32(4, image.height);
  ihdr.set([8, RGBA_COLOR_TYPE, 0, 0, 0], 8);
  const stride = image.width * 4;
  const raw = new Uint8Array(image.height * (stride + 1));
  for (let y = 0; y < image.height; y++)
    raw.set(image.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const parts = [
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    png.set(p, offset);
    offset += p.length;
  }
  return png;
}

export function paintBoxes(image: Rgba, boxes: readonly Box[], rgb: readonly [number, number, number]): Rgba {
  const data = Uint8Array.from(image.data);
  const pixel = Uint8Array.from([...rgb, 255]);
  for (const b of boxes)
    for (let y = Math.max(0, b.y); y < Math.min(image.height, b.y + b.h); y++)
      for (let x = Math.max(0, b.x); x < Math.min(image.width, b.x + b.w); x++)
        data.set(pixel, (y * image.width + x) * 4);
  return { width: image.width, height: image.height, data };
}
