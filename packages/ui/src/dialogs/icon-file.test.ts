import { expect, test } from "bun:test";
import { MAX_ICON_BYTES } from "@kibo/schema";
import { bytesToBase64, iconDataUrl, readIconFile } from "./icon-file";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test("a small png is encoded in base64 with its mime", async () => {
  const icon = await readIconFile(new File([PNG], "logo.png", { type: "image/png" }));
  expect(icon).toEqual({ mime: "image/png", data: "iVBORw0KGgo=" });
  expect(iconDataUrl(icon)).toBe("data:image/png;base64,iVBORw0KGgo=");
});

test("a file over 256 kB or of another type is refused", async () => {
  const big = new File([new Uint8Array(MAX_ICON_BYTES + 1)], "big.png", { type: "image/png" });
  await expect(readIconFile(big)).rejects.toMatchObject({ reason: "too-large" });
  const svg = new File(["<svg/>"], "a.svg", { type: "image/svg+xml" });
  await expect(readIconFile(svg)).rejects.toMatchObject({ reason: "format" });
});

test("the format is read from the file signature, not from its declared type", async () => {
  const disguised = new File(["<svg onload=alert(1)/>"], "logo.png", { type: "image/png" });
  await expect(readIconFile(disguised)).rejects.toMatchObject({ reason: "format" });
  const jpeg = await readIconFile(new File([JPEG], "photo.png", { type: "image/png" }));
  expect(jpeg.mime).toBe("image/jpeg");
  const webp = await readIconFile(new File([WEBP], "logo.webp", { type: "image/webp" }));
  expect(webp.mime).toBe("image/webp");
});

test("base64 encoding works beyond one 32 kB chunk", () => {
  const bytes = new Uint8Array(70_000).fill(65);
  expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
});
