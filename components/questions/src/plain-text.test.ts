import { expect, test } from "bun:test";
import { plainText } from "./plain-text";

test("emphasis and code lose their marks", () => {
  expect(plainText("Les **clés API** du `compte` et __rien__ d'autre")).toEqual([
    "Les clés API du compte et rien d'autre",
  ]);
});

test("lists stay readable, one item per line", () => {
  expect(plainText("Deux cas :\n- photos\n* plans\n\n1. d'abord\n2) ensuite")).toEqual([
    "Deux cas :",
    "• photos",
    "• plans",
    "1. d'abord",
    "2. ensuite",
  ]);
});

test("headings become lines, paragraphs are joined and blank lines dropped", () => {
  expect(plainText("## Contexte\nune phrase\nsur deux lignes\n\n\nfin")).toEqual([
    "Contexte",
    "une phrase sur deux lignes",
    "fin",
  ]);
  expect(plainText("  \n ")).toEqual([]);
});

test("a link keeps its text and its address", () => {
  expect(plainText("Voir [la maquette](https://example.com/m)")).toEqual([
    "Voir la maquette (https://example.com/m)",
  ]);
});
