import { expect, test } from "bun:test";
import { visibleLines } from "./log-lines";

const log = {
  text: "setup\n##[error]Test failed\nnpm ERR! code 1\ndone",
  truncated: false,
  errorLines: [2, 3],
};

test("numbers lines and flags errors", () => {
  expect(visibleLines(log, "", false)).toEqual([
    { n: 1, text: "setup", error: false },
    { n: 2, text: "##[error]Test failed", error: true },
    { n: 3, text: "npm ERR! code 1", error: true },
    { n: 4, text: "done", error: false },
  ]);
});

test("filters by errors and by a case-insensitive query", () => {
  expect(visibleLines(log, "", true).map((l) => l.n)).toEqual([2, 3]);
  expect(visibleLines(log, "NPM", false).map((l) => l.n)).toEqual([3]);
  expect(visibleLines(log, "setup", true)).toEqual([]);
});
