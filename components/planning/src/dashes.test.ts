import { expect, test } from "bun:test";
import { dashedBorder, dashStops } from "./dashes";

test("a side that starts on a dash draws it first", () => {
  expect(dashStops(0, "red")).toBe("red 0px 11px, transparent 11px 22px");
});

test("a side that starts inside a gap waits for the next dash", () => {
  expect(dashStops(14.5, "red")).toBe("transparent 0px 7.5px, red 7.5px 18.5px, transparent 18.5px 22px");
});

test("a side that starts inside a dash finishes it, then draws the next", () => {
  expect(dashStops(5, "red")).toBe("red 0px 6px, transparent 6px 17px, red 17px 22px");
});

test("the dashes run clockwise around the box, one phase per side, corners left out", () => {
  const sides = dashedBorder({ width: 194, height: 120, radius: 8, color: "red" });
  expect(sides.backgroundPosition).toBe("8px 0px, 100% 8px, 8px 100%, 0px 8px");
  expect(sides.backgroundSize).toBe("178px 1px, 1px 104px, 178px 1px, 1px 104px");
  expect(sides.backgroundRepeat).toBe("no-repeat");
  const images = sides.backgroundImage.split("repeating-linear-gradient").slice(1);
  expect(images.map((i) => i.slice(1, i.indexOf(",")))).toEqual([
    "to right",
    "to bottom",
    "to left",
    "to top",
  ]);
  expect(images[1]).toContain("transparent 0px 7.434px, red 7.434px 18.434px");
});
