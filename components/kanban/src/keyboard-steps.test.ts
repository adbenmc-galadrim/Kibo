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
