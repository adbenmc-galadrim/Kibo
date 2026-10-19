import { expect, test } from "bun:test";
import { projectInitials } from "./project-initials";

test("one word gives its first letter, several give the first two meaningful words", () => {
  expect(projectInitials("Silo")).toBe("S");
  expect(projectInitials("Site de la boulangerie")).toBe("SB");
  expect(projectInitials("Refonte site Maison Lune")).toBe("RS");
  expect(projectInitials("  kibo  ")).toBe("K");
  expect(projectInitials("l'atelier d'été")).toBe("AÉ");
  expect(projectInitials("2026 · Démo")).toBe("2D");
  expect(projectInitials("")).toBe("?");
});
