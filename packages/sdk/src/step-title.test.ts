import { expect, test } from "bun:test";
import { stepTitle } from "./step-title";

const f4 = { keyLabel: "SILO-29", shortKey: "F4" };

test("a client demo step is titled after its feature", () => {
  expect(stepTitle({ title: "Démo client" }, f4)).toBe("Démo · F4");
  expect(stepTitle({ title: "  démo CLIENT " }, f4)).toBe("Démo · F4");
});

test("the key stands in for a feature without short key", () => {
  expect(stepTitle({ title: "Démo client" }, { keyLabel: "SILO-29", shortKey: null })).toBe("Démo · SILO-29");
});

test("any other title, or a ticket without feature, keeps its title", () => {
  expect(stepTitle({ title: "Conflits de saisie" }, f4)).toBe("Conflits de saisie");
  expect(stepTitle({ title: "Démo client" }, null)).toBe("Démo client");
});
