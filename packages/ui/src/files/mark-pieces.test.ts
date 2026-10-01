import { expect, test } from "bun:test";
import { splitToken } from "./mark-pieces";

test("a token is cut at the edges of the matches it overlaps, without losing text", () => {
  expect(splitToken("const Kibo", 0, [7], 4)).toEqual([
    { at: 0, text: "const ", col: null, first: false },
    { at: 6, text: "Kibo", col: 7, first: true },
  ]);
  expect(splitToken("bo = 1", 8, [7], 4)).toEqual([
    { at: 8, text: "bo", col: 7, first: false },
    { at: 10, text: " = 1", col: null, first: false },
  ]);
  expect(splitToken("x", 3, [1], 2)).toEqual([{ at: 3, text: "x", col: null, first: false }]);
});
