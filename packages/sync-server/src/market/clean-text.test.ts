import { describe, expect, test } from "bun:test";
import { isCleanName, isCleanText } from "./clean-text";

const refused: Record<string, string> = {
  control: "Léa\u0007",
  format: "Léa​",
  lineSeparator: "Léa ",
  paragraphSeparator: "Léa ",
  softHyphen: "Léa­",
  hangulFiller: "Léaㅤ",
  variationSelector: "Léa️",
  tag: "Léa\u{e0041}",
  brailleBlank: "Léa⠀",
  privateUse: "Léa",
  supplementaryPrivateUse: "Léa\u{f0000}",
  unassigned: "Léa͸",
  loneSurrogate: "Léa\ud800",
  doubleSpace: "Léa  Martin",
  edgeSpace: " Léa",
  ideographicSpace: "Léa　",
  notNfc: "Léa",
  empty: "",
};

describe("isCleanText", () => {
  for (const [label, text] of Object.entries(refused)) {
    test(`refuses ${label}`, () => {
      expect(isCleanText(text)).toBe(false);
    });
  }
  test("accepts a visible combining mark", () => {
    expect(isCleanText("Léa̸")).toBe(true);
  });
  test("accepts mixed scripts in free text", () => {
    expect(isCleanText("Lеa et Admιn")).toBe(true);
  });
});

describe("isCleanName", () => {
  test("refuses what clean text refuses", () => {
    expect(isCleanName("Léa⠀")).toBe(false);
  });
  test("refuses Latin mixed with Cyrillic", () => {
    expect(isCleanName("Lеa")).toBe(false);
  });
  test("refuses Latin mixed with Greek", () => {
    expect(isCleanName("Admιn")).toBe(false);
  });
  for (const name of ["Tօm", "Ꭺdam", "ꓡéa"]) {
    test(`refuses Latin mixed with another script in ${JSON.stringify(name)}`, () => {
      expect(isCleanName(name)).toBe(false);
    });
  }
  for (const name of ["Léa Martin", "Лея", "Λέα", "李 雷", "Léa̸", "Léa 2", "Léa-Marie O'Neil"]) {
    test(`accepts ${JSON.stringify(name)}`, () => {
      expect(isCleanName(name)).toBe(true);
    });
  }
});
