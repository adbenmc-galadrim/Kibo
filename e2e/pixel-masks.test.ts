import { expect, test } from "bun:test";
import { MASK_AREA_LIMIT, maskedRatio, masksOf, outside, PIXEL_MASKS } from "./pixel-masks";

const WIDTH = 1440;
const HEIGHT = 1000;

test("every mask stays inside the 1440 × 1000 screen and says why", () => {
  for (const masks of Object.values(PIXEL_MASKS))
    for (const m of masks) {
      expect(outside(m, WIDTH, HEIGHT)).toBe(false);
      expect(m.why.length).toBeGreaterThan(10);
    }
});

test("each screen masks less than 8 % of its pixels", () => {
  const ratios = Object.fromEntries(
    Object.entries(PIXEL_MASKS).map(([screen, masks]) => [screen, maskedRatio(masks, WIDTH, HEIGHT)]),
  );
  for (const ratio of Object.values(ratios)) expect(ratio).toBeLessThan(MASK_AREA_LIMIT);
  expect(ratios).toEqual({
    planning: expect.closeTo(0.0061, 4),
    fonctionnalite: expect.closeTo(0.0285, 4),
    tickets: expect.closeTo(0.0105, 4),
  });
});

test("the union of masks counts overlapping pixels once", () => {
  const box = { x: 0, y: 0, w: 10, h: 10 };
  expect(maskedRatio([box, box, { ...box, x: 5 }], 100, 10)).toBeCloseTo(0.15, 6);
  expect(outside({ x: 1435, y: 0, w: 10, h: 10 }, WIDTH, HEIGHT)).toBe(true);
});

test("a screen without masks gets none", () => {
  expect(masksOf("kit")).toEqual([]);
  expect(masksOf("planning")).toBe(PIXEL_MASKS.planning);
});
