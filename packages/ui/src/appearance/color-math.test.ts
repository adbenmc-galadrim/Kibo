import { expect, test } from "bun:test";
import { bestOn, contrast, ensureContrast, mix } from "./color-math";

test("contrast follows the WCAG formula", () => {
  expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  expect(contrast("#71717A", "#FFFFFF")).toBeCloseTo(4.83, 1);
});

test("mix weighs the first color", () => {
  expect(mix("#FFFFFF", "#000000", 0.5).toUpperCase()).toBe("#808080");
  expect(mix("#123456", "#ABCDEF", 1).toUpperCase()).toBe("#123456");
});

test("ensureContrast moves a color until it passes on every surface", () => {
  const fixed = ensureContrast("#8B5CF6", ["#272930", "#343640"], 4.5);
  expect(contrast(fixed, "#272930")).toBeGreaterThanOrEqual(4.5);
  expect(contrast(fixed, "#343640")).toBeGreaterThanOrEqual(4.5);
});

test("ensureContrast leaves a passing color untouched", () => {
  expect(ensureContrast("#FAFAFA", ["#212124"], 4.5)).toBe("#FAFAFA");
});

test("bestOn picks the most readable of white and near black", () => {
  expect(bestOn(["#18181B"])).toBe("#FFFFFF");
  expect(bestOn(["#7FB5FB", "#CFA1FD"])).toBe("#09090B");
});
