import { expect, test } from "bun:test";
import { nextLayout } from "./next-layout";

test("widgets fill a two-column grid, left to right then downwards", () => {
  expect(nextLayout([])).toEqual({ x: 0, y: 0, w: 6, h: 6 });
  expect(nextLayout([{ x: 0, y: 0, w: 6, h: 6 }])).toEqual({ x: 6, y: 0, w: 6, h: 6 });
  expect(
    nextLayout([
      { x: 0, y: 0, w: 6, h: 6 },
      { x: 6, y: 0, w: 6, h: 6 },
    ]),
  ).toEqual({ x: 0, y: 6, w: 6, h: 6 });
});

test("the first free slot is reused and wide widgets are avoided", () => {
  expect(nextLayout([{ x: 6, y: 0, w: 6, h: 6 }])).toEqual({ x: 0, y: 0, w: 6, h: 6 });
  expect(nextLayout([{ x: 0, y: 0, w: 12, h: 6 }])).toEqual({ x: 0, y: 6, w: 6, h: 6 });
  expect(nextLayout([{ x: 3, y: 2, w: 2, h: 1 }])).toEqual({ x: 6, y: 0, w: 6, h: 6 });
});
