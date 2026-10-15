import { describe, expect, test } from "bun:test";
import { codeLines, indexOf, settingsWith } from "./arbitraries.test-helper";
import { blockSteps, commonBlocks, positionsOf } from "./blocks";
import { findOverlaps, findOverlapsSteps } from "./compare";
import { lineHashes } from "./normalize";
import { finish, STEP_UNITS, type Steps } from "./steps";
import { sha256 } from "./test-hash.test-helper";
import { windowsOf } from "./windows";

const settings = settingsWith();

function drained<T>(steps: Steps<T>): { value: T; pauses: number } {
  let pauses = 0;
  for (;;) {
    const step = steps.next();
    if (step.done) return { value: step.value, pauses };
    pauses += 1;
  }
}

const files = (key: string, count: number) =>
  indexOf(
    key,
    Array.from({ length: count }, (_, i) => ({
      path: `src/${key}-${i}.ts`,
      texts: [...codeLines(`own-${key}-${i}`, 40), ...codeLines("shared", 12)],
    })),
  );

describe("finish", () => {
  test("runs the steps to their value", () => {
    function* counted(): Steps<number> {
      yield;
      yield;
      return 3;
    }
    expect(finish(counted())).toBe(3);
  });
});

describe("findOverlapsSteps", () => {
  test("pauses along a large comparison and ends on what findOverlaps finds", () => {
    const [a, b] = [files("A", 60), files("B", 60)];
    const { value, pauses } = drained(findOverlapsSteps(a, b, settings, sha256));
    expect(pauses).toBeGreaterThan(10);
    expect(value).toEqual(findOverlaps(a, b, settings, sha256));
    expect(value.length).toBeGreaterThan(0);
  });
});

describe("blockSteps", () => {
  test("pauses inside one pair of repetitive files", () => {
    const repeated = lineHashes(
      Array.from({ length: 600 }, (_, i) => ({ line: i + 1, text: `const value${i % 7} = compute(x);` })),
      sha256,
    );
    const windows = windowsOf(repeated, sha256, 6);
    const { value, pauses } = drained(blockSteps(repeated, windows, repeated, positionsOf(windows), 8));
    expect(pauses).toBeGreaterThanOrEqual(Math.floor((windows.length * 2) / STEP_UNITS));
    expect(value).toEqual(commonBlocks(repeated, repeated, 8, sha256));
  });
});
