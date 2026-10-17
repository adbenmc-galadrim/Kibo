import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  MASK_AREA_LIMIT,
  type MaskedScreen,
  maskedRatio,
  masksOf,
  outside,
  PIXEL_HEIGHTS,
  PIXEL_MASKS,
} from "./pixel-masks";

const WIDTH = 1440;
const screens = Object.keys(PIXEL_MASKS).filter((s): s is MaskedScreen => Object.hasOwn(PIXEL_HEIGHTS, s));

test("every mask stays inside its screen and says why", () => {
  expect(screens).toEqual(["planning", "fonctionnalite", "tickets", "vue-ensemble", "graphe"]);
  for (const screen of screens)
    for (const m of PIXEL_MASKS[screen]) {
      expect(outside(m, WIDTH, PIXEL_HEIGHTS[screen])).toBe(false);
      expect(m.why.length).toBeGreaterThan(10);
    }
});

test("each screen masks at most 4 % of its pixels", () => {
  expect(MASK_AREA_LIMIT).toBe(0.04);
  for (const screen of screens)
    expect(maskedRatio(PIXEL_MASKS[screen], WIDTH, PIXEL_HEIGHTS[screen])).toBeLessThanOrEqual(
      MASK_AREA_LIMIT,
    );
});

test("no mask hides what phase 26 now draws", () => {
  const phase26 = /session|\bCI\b|changements demandés|journal|agent|Vue d'ensemble|décal/i;
  for (const screen of screens) for (const m of PIXEL_MASKS[screen]) expect(m.why).not.toMatch(phase26);
});

test("the sidebar is compared in place, without the shifted pages", () => {
  expect(existsSync(new URL("./pixel-sidebar.ts", import.meta.url))).toBe(false);
  for (const screen of screens)
    expect(PIXEL_MASKS[screen].filter((m) => m.x === 10 && m.w === 220)).toEqual([]);
});

test("the union of masks counts overlapping pixels once", () => {
  const box = { x: 0, y: 0, w: 10, h: 10 };
  expect(maskedRatio([box, box, { ...box, x: 5 }], 100, 10)).toBeCloseTo(0.15, 6);
  expect(outside({ x: 1435, y: 0, w: 10, h: 10 }, WIDTH, 1000)).toBe(true);
});

test("a screen without masks gets none", () => {
  expect(masksOf("kit")).toEqual([]);
  expect(masksOf("planning")).toBe(PIXEL_MASKS.planning);
});
