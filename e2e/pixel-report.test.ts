import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import fc from "fast-check";
import { type Box, decodePng, diffBoxes, diffReport, formatReport, pngSize } from "./pixel-report";

const RED = [255, 0, 0, 255];
const GRAY = [120, 120, 120, 255];

function image(width: number, height: number, red: readonly (readonly [number, number])[]): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(GRAY, i * 4);
  for (const [x, y] of red) data.set(RED, (y * width + x) * 4);
  return data;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(body, 8);
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function filterRow(filter: number, row: Uint8Array, prev: Uint8Array, bpp: number): Uint8Array {
  return row.map((value, i) => {
    const a = i >= bpp ? (row[i - bpp] ?? 0) : 0;
    const b = prev[i] ?? 0;
    const c = i >= bpp ? (prev[i - bpp] ?? 0) : 0;
    const predictors = [0, a, b, (a + b) >> 1, paeth(a, b, c)];
    return (value - (predictors[filter] ?? 0)) & 0xff;
  });
}

function encodePng(width: number, height: number, pixels: Uint8Array, channels: 3 | 4, filters: number[]) {
  const stride = width * channels;
  const raw = new Uint8Array((stride + 1) * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(stride);
    for (let x = 0; x < width; x++)
      for (let k = 0; k < channels; k++) row[x * channels + k] = pixels[(y * width + x) * 4 + k] ?? 0;
    const filter = filters[y % filters.length] ?? 0;
    raw[y * (stride + 1)] = filter;
    raw.set(filterRow(filter, row, prev, channels), y * (stride + 1) + 1);
    prev = row;
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, channels === 4 ? 6 : 2, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  return Buffer.concat(parts);
}

const twoClusters = image(10, 10, [
  [1, 1],
  [2, 1],
  [1, 2],
  [7, 6],
  [8, 7],
  [8, 8],
]);

test("two clusters give two boxes", () => {
  expect(diffBoxes(twoClusters, 10, 10)).toEqual([
    { x: 1, y: 1, w: 2, h: 2 },
    { x: 7, y: 6, w: 2, h: 3 },
  ]);
});

test("no different pixel gives no box", () => {
  expect(diffBoxes(image(10, 10, []), 10, 10)).toEqual([]);
});

test("a coarser cell merges nearby pixels into one zone", () => {
  const near = image(10, 10, [
    [1, 1],
    [3, 1],
  ]);
  expect(diffBoxes(near, 10, 10)).toHaveLength(2);
  expect(diffBoxes(near, 10, 10, 4)).toEqual([{ x: 1, y: 1, w: 3, h: 1 }]);
});

test("yellow anti-aliasing pixels are not differences", () => {
  const data = image(4, 4, []);
  data.set([255, 255, 0, 255], 0);
  expect(diffBoxes(data, 4, 4)).toEqual([]);
});

const inside = (box: Box, x: number, y: number) =>
  x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
const disjoint = (a: Box, b: Box) =>
  a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

test("every different pixel lies in exactly one box and boxes never overlap", () => {
  const scene = fc
    .record({ width: fc.integer({ min: 1, max: 24 }), height: fc.integer({ min: 1, max: 24 }) })
    .chain(({ width, height }) =>
      fc.record({
        width: fc.constant(width),
        height: fc.constant(height),
        cell: fc.integer({ min: 1, max: 6 }),
        red: fc.array(fc.tuple(fc.nat(width - 1), fc.nat(height - 1)), { maxLength: 60 }),
      }),
    );
  fc.assert(
    fc.property(scene, ({ width, height, cell, red }) => {
      const boxes = diffBoxes(image(width, height, red), width, height, cell);
      for (const [x, y] of red) expect(boxes.filter((b) => inside(b, x, y))).toHaveLength(1);
      for (const [i, a] of boxes.entries())
        for (const b of boxes.slice(i + 1)) expect(disjoint(a, b)).toBe(true);
      for (const box of boxes) {
        expect(box.x >= 0 && box.y >= 0 && box.x + box.w <= width && box.y + box.h <= height).toBe(true);
        expect(red.some(([x, y]) => inside(box, x, y))).toBe(true);
      }
    }),
  );
});

test("decodePng reads RGBA and RGB images through every row filter", () => {
  const width = 5;
  const height = 6;
  const pixels = new Uint8Array(width * height * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256));
  const rgb = pixels.map((v, i) => (i % 4 === 3 ? 255 : v));
  for (const channels of [3, 4] as const) {
    const png = encodePng(width, height, pixels, channels, [0, 1, 2, 3, 4, 2]);
    expect(pngSize(png)).toEqual({ width, height });
    const decoded = decodePng(png);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect([...decoded.data]).toEqual([...(channels === 4 ? pixels : rgb)]);
  }
});

test("decodePng reads a reference mockup", () => {
  const png = readFileSync(join(import.meta.dir, "../design/redesign/exports/proposition-planning-dark.png"));
  expect(pngSize(png)).toEqual({ width: 1440, height: 1000 });
  expect(decodePng(png).data).toHaveLength(1440 * 1000 * 4);
});

test("decodePng rejects what is not a PNG", () => {
  expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow("not a PNG");
});

test("diffReport counts red pixels and lists the zones", () => {
  const png = encodePng(10, 10, twoClusters, 4, [0]);
  const report = diffReport(png, 1);
  expect(report).toEqual({
    width: 10,
    height: 10,
    diffPixels: 6,
    ratio: 0.06,
    boxes: [
      { x: 1, y: 1, w: 2, h: 2 },
      { x: 7, y: 6, w: 2, h: 3 },
    ],
  });
  expect(formatReport(report)).toBe(
    ["6 px differ (6.00 %) in 2 zones", "  x=7 y=6 2×3", "  x=1 y=1 2×2"].join("\n"),
  );
});

test("formatReport lists the largest zones first and caps the list", () => {
  const report = {
    width: 100,
    height: 100,
    diffPixels: 30,
    ratio: 0.003,
    boxes: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 10, y: 10, w: 5, h: 5 },
      { x: 50, y: 50, w: 2, h: 2 },
    ],
  };
  expect(formatReport(report, 2)).toBe(
    ["30 px differ (0.30 %) in 3 zones", "  x=10 y=10 5×5", "  x=50 y=50 2×2", "  … 1 more"].join("\n"),
  );
});
