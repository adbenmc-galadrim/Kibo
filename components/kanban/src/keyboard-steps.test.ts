import { expect, test } from "bun:test";
import { stepFor } from "./keyboard-steps";

const card = { width: 180, height: 60 };
const at = { x: 10, y: 100 };

test("arrow keys move the held card one card height down or up, one column width across", () => {
  expect(stepFor("ArrowDown", at, card)).toEqual({ x: 10, y: 168 });
  expect(stepFor("ArrowUp", at, card)).toEqual({ x: 10, y: 32 });
  expect(stepFor("ArrowRight", at, card)).toEqual({ x: 198, y: 100 });
  expect(stepFor("ArrowLeft", at, card)).toEqual({ x: -178, y: 100 });
  expect(stepFor("KeyA", at, card)).toBeUndefined();
});

test("a folded column on the way stops the step on it, its centre under the card's", () => {
  const band = { left: 253, width: 40 };
  const here = { x: 310, y: 100 };
  expect(stepFor("ArrowLeft", here, card, [band])).toEqual({ x: 183, y: 100 });
  expect(stepFor("ArrowRight", { x: 0, y: 100 }, card, [band])).toEqual({ x: 183, y: 100 });
});

test("a folded column out of reach or behind the card changes nothing", () => {
  const band = { left: 253, width: 40 };
  expect(stepFor("ArrowLeft", { x: 700, y: 100 }, card, [band])).toEqual({ x: 512, y: 100 });
  expect(stepFor("ArrowRight", { x: 310, y: 100 }, card, [band])).toEqual({ x: 498, y: 100 });
  expect(stepFor("ArrowDown", { x: 183, y: 100 }, card, [band])).toEqual({ x: 183, y: 168 });
});
