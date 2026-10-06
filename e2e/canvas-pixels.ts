import type { Locator } from "@playwright/test";

export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };

export async function centerPatch(canvas: Locator, half: number): Promise<Rgb[]> {
  const png = await canvas.screenshot({ animations: "disabled" });
  return canvas.page().evaluate(
    async ({ b64, half }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = surface.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(bitmap, 0, 0);
      const x = Math.floor(bitmap.width / 2) - half;
      const y = Math.floor(bitmap.height / 2) - half;
      const { data } = ctx.getImageData(x, y, half * 2, half * 2);
      const pixels: { r: number; g: number; b: number }[] = [];
      for (let i = 0; i < data.length; i += 4)
        pixels.push({ r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0 });
      return pixels;
    },
    { b64: png.toString("base64"), half },
  );
}

export function meanColor(pixels: readonly Rgb[]): Rgb {
  const n = Math.max(pixels.length, 1);
  const sum = pixels.reduce((a, p) => ({ r: a.r + p.r, g: a.g + p.g, b: a.b + p.b }), { r: 0, g: 0, b: 0 });
  return { r: sum.r / n, g: sum.g / n, b: sum.b / n };
}

export function toHsv({ r, g, b }: Rgb): Hsv {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  const v = max / 255;
  if (d === 0) return { h: 0, s, v };
  const sector = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: sector * 60, s, v };
}

const toSrgb = (linear: number) =>
  255 * (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055);

export const srgbOf = ([r, g, b]: readonly [number, number, number]): Rgb => ({
  r: toSrgb(r),
  g: toSrgb(g),
  b: toSrgb(b),
});

export const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

export const colorGap = (a: Rgb, b: Rgb) =>
  Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));

export const share = (pixels: readonly Rgb[], keep: (hsv: Hsv) => boolean) =>
  pixels.filter((p) => keep(toHsv(p))).length / Math.max(pixels.length, 1);
