import { expect, test } from "bun:test";
import { autoRenameTarget, isUntitledPath, renamedPath, slugify } from "./note-name";

test("slugify strips accents and punctuation, never starts with a digit prefix", () => {
  expect(slugify("Architecture du sync")).toBe("architecture-du-sync");
  expect(slugify("  Réunion — kick-off !  ")).toBe("reunion-kick-off");
  expect(slugify("2026 bilan")).toBe("2026-bilan");
  expect(slugify("é")).toBe("");
  expect(slugify("#")).toBe("");
  expect(slugify("a".repeat(80))).toHaveLength(40);
});

test("untitled paths are sans-titre.md and sans-titre-<n>.md, in any folder", () => {
  expect(isUntitledPath("sans-titre.md")).toBe(true);
  expect(isUntitledPath("sans-titre-3.md")).toBe(true);
  expect(isUntitledPath("brouillons/sans-titre-12.md")).toBe(true);
  expect(isUntitledPath("sans-titre-final.md")).toBe(false);
  expect(isUntitledPath("mes-sans-titre.md")).toBe(false);
});

test("the renamed path keeps the folder and takes the slug", () => {
  expect(renamedPath("sans-titre.md", "Architecture du sync")).toBe("architecture-du-sync.md");
  expect(renamedPath("brouillons/sans-titre-2.md", "Idées")).toBe("brouillons/idees.md");
  expect(renamedPath("notes/a.md", "???")).toBeNull();
});

test("the automatic target exists only for an untitled note whose slug is new and free", () => {
  const taken = ["sans-titre.md", "architecture-du-sync.md", "journal.md"];
  expect(autoRenameTarget({ path: "sans-titre.md", title: "Plan de test" }, taken)).toBe("plan-de-test.md");
  expect(autoRenameTarget({ path: "sans-titre.md", title: "Architecture du sync" }, taken)).toBeNull();
  expect(autoRenameTarget({ path: "sans-titre.md", title: "Sans titre" }, taken)).toBeNull();
  expect(autoRenameTarget({ path: "sans-titre.md", title: "" }, taken)).toBeNull();
  expect(autoRenameTarget({ path: "journal.md", title: "Nouveau journal" }, taken)).toBeNull();
});
