export type ImageSize = { width: number; height: number };

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

const ascii = (b: Uint8Array, at: number, text: string): boolean =>
  [...text].every((c, i) => b[at + i] === c.charCodeAt(0));
const u16be = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u32be = (b: Uint8Array, at: number) => u16be(b, at) * 65_536 + u16be(b, at + 2);
const u16le = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, at: number) => u16le(b, at) | ((b[at + 2] ?? 0) << 16);

const sized = (b: Uint8Array, end: number, width: number, height: number): ImageSize | null =>
  b.length >= end && width > 0 && height > 0 ? { width, height } : null;

function pngSize(b: Uint8Array): ImageSize | null {
  if (!PNG_SIGNATURE.every((v, i) => b[i] === v) || !ascii(b, 12, "IHDR")) return null;
  return sized(b, 24, u32be(b, 16), u32be(b, 20));
}

function jpegSize(b: Uint8Array): ImageSize | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1] ?? 0;
    const length = u16be(b, at + 2);
    if (length < 2) return null;
    if (JPEG_SOF.has(marker)) return sized(b, at + 9, u16be(b, at + 7), u16be(b, at + 5));
    at += 2 + length;
  }
  return null;
}

function webpSize(b: Uint8Array): ImageSize | null {
  if (!ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  if (ascii(b, 12, "VP8 ")) return sized(b, 30, u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  if (ascii(b, 12, "VP8L")) {
    const bits = u16le(b, 21) + u16le(b, 23) * 65_536;
    return sized(b, 25, (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (ascii(b, 12, "VP8X")) return sized(b, 30, u24le(b, 24) + 1, u24le(b, 27) + 1);
  return null;
}

export function imageSize(bytes: Uint8Array): ImageSize | null {
  return pngSize(bytes) ?? jpegSize(bytes) ?? webpSize(bytes);
}
