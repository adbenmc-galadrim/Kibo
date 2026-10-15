import { expect, test } from "bun:test";
import { imageSize } from "./image-size";

const bytes = (...parts: (number[] | string)[]): Uint8Array =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16be = (n: number) => [(n >>> 8) & 255, n & 255];
const u16le = (n: number) => [n & 255, (n >>> 8) & 255];
const u24le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const riff = (chunk: string, body: number[]) =>
  bytes("RIFF", [0, 0, 0, 0], "WEBP", chunk, [0, 0, 0, 0], body);

test("a PNG gives its size from the IHDR chunk", () => {
  const png = bytes(
    [137, 80, 78, 71, 13, 10, 26, 10],
    u32be(13),
    "IHDR",
    u32be(1440),
    u32be(900),
    [8, 6, 0, 0, 0],
  );
  expect(imageSize(png)).toEqual({ width: 1440, height: 900 });
});

test("a JPEG gives its size from the first SOF frame, after other segments", () => {
  const app0 = [0xff, 0xe0, ...u16be(6), 74, 70, 73, 70];
  const dht = [0xff, 0xc4, ...u16be(4), 0, 0];
  const sof0 = [0xff, 0xc0, ...u16be(11), 8, ...u16be(600), ...u16be(800), 3, 1, 0x22, 0];
  expect(imageSize(bytes([0xff, 0xd8], app0, dht, sof0))).toEqual({ width: 800, height: 600 });
  const sof2 = [0xff, 0xc2, ...u16be(11), 8, ...u16be(30), ...u16be(40), 3, 1, 0x22, 0];
  expect(imageSize(bytes([0xff, 0xd8], sof2))).toEqual({ width: 40, height: 30 });
});

test("a WebP gives its size for the lossy, lossless and extended forms", () => {
  const lossy = riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(320), ...u16le(240)]);
  expect(imageSize(lossy)).toEqual({ width: 320, height: 240 });
  const w = 1023;
  const h = 511;
  const bits = (w - 1) | ((h - 1) << 14);
  const lossless = riff("VP8L", [
    0x2f,
    bits & 255,
    (bits >>> 8) & 255,
    (bits >>> 16) & 255,
    (bits >>> 24) & 255,
  ]);
  expect(imageSize(lossless)).toEqual({ width: w, height: h });
  const extended = riff("VP8X", [0, 0, 0, 0, ...u24le(1919), ...u24le(1079)]);
  expect(imageSize(extended)).toEqual({ width: 1920, height: 1080 });
});

test("an unknown or truncated file has no size", () => {
  expect(imageSize(bytes("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
  expect(imageSize(bytes([137, 80, 78, 71, 13, 10, 26, 10], u32be(13), "IHDR"))).toBeNull();
  expect(imageSize(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 2]))).toBeNull();
  expect(imageSize(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBeNull();
  expect(imageSize(riff("VP8 ", [0, 0]))).toBeNull();
  expect(imageSize(new Uint8Array())).toBeNull();
});
