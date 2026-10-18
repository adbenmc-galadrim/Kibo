import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTerms, parseTerms } from "./terms";

test("parseTerms keeps one trimmed term per non-empty line", () => {
  expect(parseTerms("a\n\n  b-c \n")).toEqual(["a", "b-c"]);
});

test("parseTerms accepts Windows line endings", () => {
  expect(parseTerms("tolo\r\nzoé\r\n")).toEqual(["tolo", "zoé"]);
});

test("loadTerms returns null when the list is missing", () => {
  expect(loadTerms("/nulle/part")).toBeNull();
});

test("loadTerms reads the list from disk", () => {
  const path = join(mkdtempSync(join(tmpdir(), "kibo-terms-")), "termes.txt");
  writeFileSync(path, "tolo\nzoé\n");
  expect(loadTerms(path)).toEqual(["tolo", "zoé"]);
});
