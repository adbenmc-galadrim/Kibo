import { describe, expect, test } from "bun:test";
import {
  COMPONENT_FORMATS,
  FORMAT_PREFERENCE,
  FORMAT_SIZES,
  formatOf,
  inGrid,
  isFormatLayout,
  layoutFor,
  nearestFormat,
  overlaps,
} from "./format";

describe("formats", () => {
  test("every format has a distinct size and formatOf finds it back", () => {
    const sizes = Object.values(FORMAT_SIZES).map((s) => `${s.w}x${s.h}`);
    expect(new Set(sizes).size).toBe(sizes.length);
    for (const format of COMPONENT_FORMATS) expect(formatOf(FORMAT_SIZES[format])).toBe(format);
    expect(formatOf({ w: 5, h: 5 })).toBeNull();
  });

  test("legacy defaults are formats", () => {
    expect(formatOf({ w: 6, h: 6 })).toBe("large");
    expect(formatOf({ w: 12, h: 6 })).toBe("half");
  });

  test("the preference lists every format once", () => {
    expect([...FORMAT_PREFERENCE].sort()).toEqual([...COMPONENT_FORMATS].sort());
  });

  test("nearestFormat picks the closest area and breaks ties by preference", () => {
    expect(nearestFormat({ w: 5, h: 5 })).toBe("medium");
    expect(nearestFormat({ w: 6, h: 5 })).toBe("large");
    expect(nearestFormat({ w: 4, h: 4 })).toBe("medium");
    expect(nearestFormat({ w: 9, h: 3 })).toBe("medium");
    expect(nearestFormat({ w: 12, h: 12 })).toBe("full");
    expect(nearestFormat({ w: 1, h: 1 })).toBe("small");
  });

  test("inGrid and overlaps", () => {
    expect(inGrid(layoutFor("half", 0, 394))).toBe(true);
    expect(inGrid(layoutFor("half", 0, 395))).toBe(false);
    expect(inGrid(layoutFor("small", 9, 0))).toBe(true);
    expect(inGrid(layoutFor("small", 10, 0))).toBe(false);
    expect(overlaps(layoutFor("small", 0, 0), layoutFor("small", 2, 2))).toBe(true);
    expect(overlaps(layoutFor("small", 0, 0), layoutFor("small", 3, 0))).toBe(false);
    expect(overlaps(layoutFor("small", 0, 0), layoutFor("small", 0, 3))).toBe(false);
    expect(isFormatLayout({ x: 0, y: 0, w: 3, h: 3 })).toBe(true);
    expect(isFormatLayout({ x: 0, y: 0, w: 3, h: 6 })).toBe(false);
  });
});
