import { inflateSync } from "node:zlib";

export type Box = { x: number; y: number; w: number; h: number };
export type Rgba = { width: number; height: number; data: Uint8Array };
export type DiffReport = { width: number; height: number; diffPixels: number; ratio: number; boxes: Box[] };

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS: Record<number, number> = { 2: 3, 6: 4 };

type Chunk = { type: string; data: Uint8Array };

function readChunks(png: Uint8Array): Chunk[] {
  if (png.length < 8 || SIGNATURE.some((byte, i) => png[i] !== byte)) throw new Error("not a PNG");
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: png.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function header(chunks: Chunk[]) {
  const ihdr = chunks[0];
  if (ihdr?.type !== "IHDR") throw new Error("PNG without IHDR");
  const view = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
  return {
    width: view.getUint32(0),
    height: view.getUint32(4),
    bitDepth: ihdr.data[8],
    colorType: ihdr.data[9] ?? -1,
    interlace: ihdr.data[12],
  };
}

export function pngSize(png: Uint8Array): { width: number; height: number } {
  const { width, height } = header(readChunks(png));
  return { width, height };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function predictor(filter: number, a: number, b: number, c: number): number {
  if (filter === 0) return 0;
  if (filter === 1) return a;
  if (filter === 2) return b;
  if (filter === 3) return (a + b) >> 1;
  if (filter === 4) return paeth(a, b, c);
  throw new Error(`unknown PNG filter ${filter}`);
}

function unfilter(raw: Uint8Array, height: number, stride: number, bpp: number): Uint8Array {
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? (out[row + i - bpp] ?? 0) : 0;
      const b = y > 0 ? (out[row - stride + i] ?? 0) : 0;
      const c = i >= bpp && y > 0 ? (out[row - stride + i - bpp] ?? 0) : 0;
      out[row + i] = ((raw[y * (stride + 1) + 1 + i] ?? 0) + predictor(filter, a, b, c)) & 0xff;
    }
  }
  return out;
}

export function decodePng(png: Uint8Array): Rgba {
  const chunks = readChunks(png);
  const { width, height, bitDepth, colorType, interlace } = header(chunks);
  const channels = CHANNELS[colorType];
  if (bitDepth !== 8 || channels === undefined || interlace !== 0)
    throw new Error(`unsupported PNG (depth ${bitDepth}, color type ${colorType}, interlace ${interlace})`);
  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  const pixels = unfilter(inflateSync(idat), height, width * channels, channels);
  if (channels === 4) return { width, height, data: pixels };
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data.set(pixels.subarray(i * 3, i * 3 + 3), i * 4);
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

const isDiffPixel = (data: Uint8Array, i: number): boolean =>
  data[i * 4] === 255 && data[i * 4 + 1] === 0 && data[i * 4 + 2] === 0;

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function absorb(boxes: Box[]): Box[] {
  const kept: Box[] = [];
  for (const box of boxes) {
    const hit = kept.findIndex((other) => overlaps(other, box));
    const other = kept[hit];
    if (other === undefined) kept.push(box);
    else kept[hit] = union(other, box);
  }
  return kept;
}

function mergeOverlapping(boxes: Box[]): Box[] {
  let merged = boxes;
  for (let next = absorb(merged); next.length < merged.length; next = absorb(merged)) merged = next;
  return merged;
}

function cellBoxes(diff: Uint8Array, width: number, height: number, cell: number) {
  const cols = Math.ceil(width / cell);
  const cells = new Map<number, Box>();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!isDiffPixel(diff, y * width + x)) continue;
      const key = Math.floor(y / cell) * cols + Math.floor(x / cell);
      const pixel = { x, y, w: 1, h: 1 };
      const known = cells.get(key);
      cells.set(key, known === undefined ? pixel : union(known, pixel));
    }
  return { cols, rows: Math.ceil(height / cell), cells };
}

function neighbours(key: number, cols: number, rows: number): number[] {
  const cx = key % cols;
  const cy = Math.floor(key / cols);
  const around: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;
      if ((dx !== 0 || dy !== 0) && nx >= 0 && ny >= 0 && nx < cols && ny < rows) around.push(ny * cols + nx);
    }
  return around;
}

export function diffBoxes(diff: Uint8Array, width: number, height: number, cell = 1): Box[] {
  const { cols, rows, cells } = cellBoxes(diff, width, height, cell);
  const seen = new Set<number>();
  const boxes: Box[] = [];
  for (const [start, first] of cells) {
    if (seen.has(start)) continue;
    seen.add(start);
    let box = first;
    const stack = [start];
    for (let key = stack.pop(); key !== undefined; key = stack.pop())
      for (const next of neighbours(key, cols, rows)) {
        const found = cells.get(next);
        if (found === undefined || seen.has(next)) continue;
        seen.add(next);
        box = union(box, found);
        stack.push(next);
      }
    boxes.push(box);
  }
  return mergeOverlapping(boxes).sort((a, b) => a.y - b.y || a.x - b.x);
}

export function diffReport(png: Uint8Array, cell = 16): DiffReport {
  const { width, height, data } = decodePng(png);
  let diffPixels = 0;
  for (let i = 0; i < width * height; i++) if (isDiffPixel(data, i)) diffPixels++;
  return {
    width,
    height,
    diffPixels,
    ratio: diffPixels / (width * height),
    boxes: diffBoxes(data, width, height, cell),
  };
}

export function formatReport(report: DiffReport, limit = 20): string {
  const largest = [...report.boxes].sort((a, b) => b.w * b.h - a.w * a.h);
  const lines = largest.slice(0, limit).map((b) => `  x=${b.x} y=${b.y} ${b.w}×${b.h}`);
  const rest = largest.length - limit;
  return [
    `${report.diffPixels} px differ (${(report.ratio * 100).toFixed(2)} %) in ${report.boxes.length} zones`,
    ...lines,
    ...(rest > 0 ? [`  … ${rest} more`] : []),
  ].join("\n");
}
