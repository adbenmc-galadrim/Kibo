import { expect, test } from "bun:test";
import { suggestProjectKey } from "./project-key";

test.each([
  ["Kibo", "KIB"],
  ["Emis", "EMI"],
  ["Suivi de chantier", "SC"],
  ["Gestion des stocks et des achats", "GSA"],
  ["De la suite", "DLS"],
  ["API Facturation", "AF"],
  ["Mon super projet", "MSP"],
  ["écran", "ECR"],
  ["a b c d e f g", "ABCDEF"],
  ["X", ""],
  ["  ", ""],
])("suggestProjectKey(%p) = %p", (name, key) => {
  expect(suggestProjectKey(name)).toBe(key);
});
