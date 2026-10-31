import { expect, test } from "bun:test";
import { deliveryStepLabel } from "@kibo/schema";
import { phaseLabel, stepLabelShort } from "./phase-label";

test("the label reads Étape 9/12 · Review", () => {
  expect(phaseLabel(9, "Review")).toBe("Étape 9/12 · Review");
  expect(phaseLabel(0, "Lecture")).toBe("Étape 0/12 · Lecture");
});

test("the short label has no name", () => {
  expect(stepLabelShort(11)).toBe("Étape 11/12");
});

test("the named label of a step comes from the same source", () => {
  expect(deliveryStepLabel(9)).toBe(phaseLabel(9, "Review"));
});
