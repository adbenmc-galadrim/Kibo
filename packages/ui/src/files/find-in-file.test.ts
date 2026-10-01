import { expect, test } from "bun:test";
import { findMatches, parseGoTo, stepMatch } from "./find-in-file";

test("findMatches is case-insensitive, lists every occurrence in order, and is empty for an empty query", () => {
  expect(findMatches(["const Kibo = 1;", "kibo.run(); KIBO"], "kibo")).toEqual([
    { line: 1, col: 7 },
    { line: 2, col: 1 },
    { line: 2, col: 13 },
  ]);
  expect(findMatches(["a"], "")).toEqual([]);
  expect(findMatches(["aaaa"], "aa")).toEqual([
    { line: 1, col: 1 },
    { line: 1, col: 3 },
  ]);
});

test("parseGoTo reads :42 and nothing else; stepMatch wraps around", () => {
  expect(parseGoTo(":42")).toBe(42);
  expect(parseGoTo("42")).toBeNull();
  expect(parseGoTo(":0")).toBeNull();
  expect(parseGoTo(":4a")).toBeNull();
  const s = {
    query: "k",
    matches: [
      { line: 1, col: 1 },
      { line: 3, col: 1 },
    ],
    index: 1,
  };
  expect(stepMatch(s, 1).index).toBe(0);
  expect(stepMatch(s, -1).index).toBe(0);
  expect(stepMatch({ ...s, index: 0 }, -1).index).toBe(1);
  expect(stepMatch({ query: "k", matches: [], index: 0 }, 1).index).toBe(0);
});
