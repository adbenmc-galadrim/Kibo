import { expect, test } from "bun:test";
import { comparisonOutcome } from "./pixel-outcome";

test("a comparison that passed is exact", () => {
  expect(comparisonOutcome({ kind: "passed" }, null)).toEqual({ kind: "exact" });
});

test("a comparison that failed with a diff image hands the image over", () => {
  expect(comparisonOutcome({ kind: "failed", error: new Error("differ") }, "/tmp/a-diff.png")).toEqual({
    kind: "diff",
    path: "/tmp/a-diff.png",
  });
});

test("a comparison that failed without any diff image rethrows its error", () => {
  const error = new Error("reference missing");
  expect(() => comparisonOutcome({ kind: "failed", error }, null)).toThrow(error);
});

test("a diff image left by an earlier comparison never turns a pass into a failure", () => {
  expect(comparisonOutcome({ kind: "passed" }, "/tmp/old-diff.png")).toEqual({ kind: "exact" });
});
