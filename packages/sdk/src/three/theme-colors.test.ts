import { expect, test } from "bun:test";
import { parseCssColor, themeColors, ZINC_FALLBACK } from "./theme-colors";

test("colors are read through a 2d probe and fall back to zinc without one", () => {
  const probe = {
    fillStyle: "",
    fillRect() {},
    getImageData: () => ({ data: Uint8ClampedArray.from([24, 24, 27, 255]) }),
  } as unknown as CanvasRenderingContext2D;
  expect(parseCssColor("oklch(0.21 0.006 285.885)", probe)).toEqual([24, 24, 27]);
  expect(parseCssColor("oklch(0.21 0.006 285.885)", null)).toBeNull();
  const dark = themeColors(document.documentElement, null, true);
  expect(dark.background.getHex()).toBe(ZINC_FALLBACK.dark.background);
  expect(themeColors(document.documentElement, null, false).background.getHex()).toBe(
    ZINC_FALLBACK.light.background,
  );
});

test("a theme variable read through the probe keeps its srgb value", () => {
  const probe = {
    fillStyle: "",
    fillRect() {},
    getImageData: () => ({ data: Uint8ClampedArray.from([24, 24, 27, 255]) }),
  } as unknown as CanvasRenderingContext2D;
  const root = document.createElement("div");
  root.style.setProperty("--card", "oklch(0.21 0.006 285.885)");
  document.body.append(root);
  expect(themeColors(root, probe, false).background.getHex()).toBe(0x18181b);
  expect(themeColors(root, probe, false).muted.getHex()).toBe(ZINC_FALLBACK.light.muted);
  root.remove();
});
