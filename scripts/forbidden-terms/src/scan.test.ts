import { expect, test } from "bun:test";
import { findForbidden, isBinary, maskTerms } from "./scan";

const terms = ["tolo", "tolo-suivi", "Dossier/tolo", "zoé"];

test("matches whole words whatever the case", () => {
  expect(findForbidden("TOLO et Tolo", terms)).toEqual([
    { term: 1, line: 1 },
    { term: 1, line: 1 },
  ]);
});

test("ignores a term embedded in a longer word", () => {
  expect(findForbidden("retolo tolos tolo_x tolo2", terms)).toEqual([]);
});

test("finds a hyphenated term and its whole-word part", () => {
  expect(findForbidden("x tolo-suivi y", terms)).toEqual([
    { term: 1, line: 1 },
    { term: 2, line: 1 },
  ]);
});

test("finds a term containing a slash", () => {
  expect(findForbidden("Dossier/tolo", terms)).toEqual([
    { term: 1, line: 1 },
    { term: 3, line: 1 },
  ]);
});

test("compares accented letters case-insensitively", () => {
  expect(findForbidden("Zoé", terms)).toEqual([{ term: 4, line: 1 }]);
  expect(findForbidden("ZOÉ", terms)).toEqual([{ term: 4, line: 1 }]);
  expect(findForbidden("zoéa", terms)).toEqual([]);
});

test("matches a decomposed accented letter", () => {
  expect(findForbidden("Zoé", terms)).toEqual([{ term: 4, line: 1 }]);
});

test("reports the line of each match", () => {
  expect(findForbidden("rien\nici tolo\n\nZoé et tolo", terms)).toEqual([
    { term: 1, line: 2 },
    { term: 1, line: 4 },
    { term: 4, line: 4 },
  ]);
});

test("detects a null byte as binary", () => {
  expect(isBinary(new Uint8Array([0x89, 0x50, 0, 1]))).toBe(true);
  expect(isBinary(Buffer.from("texte"))).toBe(false);
});

test("only looks at the first 8 KiB for a null byte", () => {
  const head = new Uint8Array(9000).fill(0x61);
  head[8500] = 0;
  expect(isBinary(head)).toBe(false);
});

test("maskTerms replaces each term by its number", () => {
  expect(maskTerms("docs/TOLO-suivi/retolo/Zoé.md", terms)).toBe("docs/<terme 2>/retolo/<terme 4>.md");
});
