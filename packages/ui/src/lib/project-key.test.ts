import { expect, test } from "bun:test";
import { suggestProjectKey } from "./project-key";

test.each([
  ["Kibo", "KIB"],
  ["API Facturation", "AF"],
  ["Mon super projet", "MSP"],
  ["écran", "ECR"],
  ["a b c d e f g", "ABCDEF"],
  ["X", ""],
  ["  ", ""],
])("suggestProjectKey(%p) = %p", (name, key) => {
  expect(suggestProjectKey(name)).toBe(key);
});
