import { expect, test } from "bun:test";
import { phaseLabel } from "./phase-label";

test("a delivery phase reads « Phase n/12 · name »", () => {
  expect(phaseLabel(9, "Review")).toBe("Phase 9/12 · Review");
  expect(phaseLabel(0, "Lecture")).toBe("Phase 0/12 · Lecture");
});
