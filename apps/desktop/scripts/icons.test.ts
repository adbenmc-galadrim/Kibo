import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";

const icons = resolve(import.meta.dir, "../src-tauri/icons");
const png = (name: string) => {
  const bytes = readFileSync(resolve(icons, name));
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
const icnsTypes = (): string[] => {
  const bytes = readFileSync(resolve(icons, "icon.icns"));
  expect(bytes.subarray(0, 4).toString("latin1")).toBe("icns");
  const types: string[] = [];
  for (let at = 8; at + 8 <= bytes.length; ) {
    types.push(bytes.subarray(at, at + 4).toString("latin1"));
    at += Math.max(8, bytes.readUInt32BE(at + 4));
  }
  return types;
};

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
const unfilter = (filter: number, raw: number, left: number, up: number, upLeft: number) => {
  if (filter === 1) return raw + left;
  if (filter === 2) return raw + up;
  if (filter === 3) return raw + ((left + up) >> 1);
  if (filter === 4) return raw + paeth(left, up, upLeft);
  return raw;
};
const rgbaRows = (name: string): Uint8Array[] => {
  const bytes = readFileSync(resolve(icons, name));
  const { width } = png(name);
  const idat: Buffer[] = [];
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    if (bytes.subarray(at + 4, at + 8).toString("latin1") === "IDAT")
      idat.push(bytes.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  const data = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rows: Uint8Array[] = [];
  for (let y = 0; y * (stride + 1) < data.length; y++) {
    const row = new Uint8Array(stride);
    const previous = rows[y - 1] ?? new Uint8Array(stride);
    const filter = data[y * (stride + 1)] ?? 0;
    for (let i = 0; i < stride; i++) {
      const raw = data[y * (stride + 1) + 1 + i] ?? 0;
      const left = i >= 4 ? (row[i - 4] ?? 0) : 0;
      const upLeft = i >= 4 ? (previous[i - 4] ?? 0) : 0;
      row[i] = unfilter(filter, raw, left, previous[i] ?? 0, upLeft) & 0xff;
    }
    rows.push(row);
  }
  return rows;
};
const alphaAt = (rows: Uint8Array[], x: number, y: number) => rows[y]?.[x * 4 + 3];

test("the raster icons have the sizes tauri.conf.json expects", () => {
  expect(png("32x32.png")).toEqual({ width: 32, height: 32 });
  expect(png("128x128.png")).toEqual({ width: 128, height: 128 });
  expect(png("128x128@2x.png")).toEqual({ width: 256, height: 256 });
  expect(png("icon.png")).toEqual({ width: 512, height: 512 });
});

test("the icns carries the 1024 px slot that macOS shows in the app switcher", () => {
  expect(icnsTypes()).toContain("ic10");
});

test("the icons were regenerated after the Apple grid margin", () => {
  const svg = readFileSync(resolve(import.meta.dir, "../app-icon.svg"), "utf8");
  expect(svg).toContain('x="116.48" y="116.48" width="791.04"');
  const bytes = readFileSync(resolve(icons, "icon.png"));
  expect(bytes.readUInt8(25)).toBe(6);
  const rows = rgbaRows("icon.png");
  expect(alphaAt(rows, 40, 256)).toBe(0);
  expect(alphaAt(rows, 256, 40)).toBe(0);
  expect(alphaAt(rows, 256, 256)).toBe(255);
});
