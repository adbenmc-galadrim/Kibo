import { expect, test } from "bun:test";
import { fitScale } from "./preview-scale";

test("the frame shrinks to the available width and never grows", () => {
  expect(fitScale(598, 1196)).toBe(0.5);
  expect(fitScale(1500, 1196)).toBe(1);
  expect(fitScale(0, 1196)).toBe(1);
  expect(fitScale(Number.NaN, 1196)).toBe(1);
  expect(fitScale(300, 0)).toBe(1);
});
