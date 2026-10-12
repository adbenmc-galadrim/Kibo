import { describe, expect, test } from "bun:test";
import { lineHashes } from "./normalize";
import { sha256 } from "./test-hash.test-helper";
import { windowsOf } from "./windows";

const hashed = (count: number, prefix = "line") =>
  lineHashes(
    Array.from({ length: count }, (_, i) => ({ line: i + 1, text: `${prefix} ${i}` })),
    sha256,
  );

describe("windowsOf", () => {
  test("needs six lines", () => {
    expect(windowsOf(hashed(5), sha256)).toEqual([]);
  });

  test("six lines make one window at 0", () => {
    const windows = windowsOf(hashed(6), sha256);
    expect(windows.map((w) => w.at)).toEqual([0]);
    expect(windows[0]?.hash).toHaveLength(16);
  });

  test("eight lines make three windows", () => {
    expect(windowsOf(hashed(8), sha256).map((w) => w.at)).toEqual([0, 1, 2]);
  });

  test("identical lines give identical windows", () => {
    expect(windowsOf(hashed(7), sha256)).toEqual(windowsOf(hashed(7), sha256));
    expect(windowsOf(hashed(6, "x"), sha256)).not.toEqual(windowsOf(hashed(6), sha256));
  });
});
