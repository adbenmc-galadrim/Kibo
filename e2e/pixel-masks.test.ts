import { expect, test } from "bun:test";
import {
  MASK_AREA_LIMIT,
  maskedRatio,
  masksOf,
  outside,
  PIXEL_MASKS,
  PROJECT_PAGES_SHIFT,
  PROJECT_PAGES_ZONE,
  projectRows,
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
    planning: expect.closeTo(0.0348, 3),
    fonctionnalite: expect.closeTo(0.0572, 3),
    tickets: expect.closeTo(0.0392, 3),
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

test("only the text lines of the shifted sidebar rows are masked, plus the active row band", () => {
  const rows = projectRows(2);
  expect(rows).toHaveLength(10);
  expect(rows.slice(0, 9).map((r) => r.y)).toEqual([264, 296, 328, 360, 392, 424, 456, 488, 520]);
  expect(rows.every((r) => r.x === 10 && r.w === 220)).toBe(true);
  expect(rows[9]).toMatchObject({ y: 290, h: 62 });
  expect(maskedRatio(rows, WIDTH, HEIGHT)).toBeCloseTo(0.0287, 3);
  for (const [screen, active] of [
    ["planning", 1],
    ["fonctionnalite", 1],
    ["tickets", 2],
  ] as const)
    for (const row of projectRows(active)) expect(PIXEL_MASKS[screen]).toContainEqual(row);
  expect(PROJECT_PAGES_ZONE).toEqual({ x: 10, y: 256, w: 220, h: 320 });
  expect(PROJECT_PAGES_SHIFT).toBe(32);
});
