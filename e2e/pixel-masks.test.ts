import { expect, test } from "bun:test";
import {
  MASK_AREA_LIMIT,
  maskedRatio,
  masksOf,
  outside,
  PIXEL_MASKS,
  PROJECT_PAGES,
  PROJECT_PAGES_SHIFT,
} from "./pixel-masks";

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
    planning: expect.closeTo(0.0559, 4),
    fonctionnalite: expect.closeTo(0.0783, 4),
    tickets: expect.closeTo(0.0603, 4),
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

test("the project pages of the sidebar are masked on every screen, to be compared shifted by 32 px", () => {
  for (const masks of Object.values(PIXEL_MASKS)) expect(masks).toContain(PROJECT_PAGES);
  expect(PROJECT_PAGES).toMatchObject({ x: 8, y: 256, w: 224, h: 320 });
  expect(PROJECT_PAGES_SHIFT).toBe(32);
});
