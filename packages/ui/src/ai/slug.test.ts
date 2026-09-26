import { expect, test } from "bun:test";
import { slugify, suggestTitle } from "./slug";

test("suggestTitle takes the first three words", () => {
  expect(suggestTitle("burndown du sprint : tickets restants par jour")).toBe("Burndown du sprint");
  expect(suggestTitle("  ")).toBe("");
});

test("slugify builds a valid component id", () => {
  expect(slugify("Burndown du sprint")).toBe("burndown-du-sprint");
  expect(slugify("Écran d'accueil !")).toBe("ecran-d-accueil");
  expect(slugify("2025 · bilan")).toBe("c-2025-bilan");
  expect(slugify("é")).toBe("");
  expect(slugify("x".repeat(80))).toHaveLength(40);
});
