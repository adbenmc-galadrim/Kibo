import { expect, test } from "bun:test";
import type { GraphEdge } from "./critical-path";
import { focusSet } from "./focus";

const blocks = (from: string, to: string): GraphEdge => ({ from, to, type: "blocks" });

test("focus reaches two levels of blockers and of unblocked tickets", () => {
  const edges = [blocks("A", "B"), blocks("B", "C"), blocks("C", "D"), blocks("D", "E")];
  expect(focusSet(edges, "C", 2)).toEqual({ up: new Set(["B", "A"]), down: new Set(["D", "E"]) });
  expect(focusSet(edges, "A", 2)).toEqual({ up: new Set(), down: new Set(["B", "C"]) });
});

test("focus follows branches and ignores relates links", () => {
  const edges = [
    blocks("A", "C"),
    blocks("B", "C"),
    blocks("C", "D"),
    blocks("C", "E"),
    blocks("E", "F"),
    { from: "C", to: "G", type: "relates" as const },
  ];
  expect(focusSet(edges, "C", 2)).toEqual({ up: new Set(["A", "B"]), down: new Set(["D", "E", "F"]) });
});

test("a duplicated link does not loop", () => {
  const edges = [blocks("A", "B"), blocks("A", "B"), blocks("B", "C")];
  expect(focusSet(edges, "B", 2)).toEqual({ up: new Set(["A"]), down: new Set(["C"]) });
});
