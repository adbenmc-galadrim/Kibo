import { expect, test } from "bun:test";
import { plainText } from "./plain-text";

test("emphasis, strike-through and code lose their marks", () => {
  expect(plainText("Les **clés API** du `compte`, *it*, _u_, __gras du jour__ et ~~s~~")).toEqual([
    "Les clés API du compte, it, u, gras du jour et s",
  ]);
});

test("marks inside an identifier or a dunder name are kept", () => {
  expect(plainText("Appeler __init__ puis snake_case__name et a*b*c")).toEqual([
    "Appeler __init__ puis snake_case__name et a*b*c",
  ]);
});

test("escapes lose their backslash", () => {
  expect(plainText("Un \\*astérisque\\* et un \\_tiret\\_")).toEqual(["Un *astérisque* et un _tiret_"]);
});

test("lists stay readable, one item per line, two spaces per level", () => {
  expect(
    plainText("Deux cas :\n\n- photos\n  - avant\n    - brutes\n- plans\n\n1. d'abord\n2) ensuite"),
  ).toEqual(["Deux cas :", "• photos", "  • avant", "    • brutes", "• plans", "1. d'abord", "2. ensuite"]);
});

test("headings become lines, blank lines are dropped", () => {
  expect(plainText("## Contexte\nune phrase\nsur deux lignes\n\n\nfin")).toEqual([
    "Contexte",
    "une phrase",
    "sur deux lignes",
    "fin",
  ]);
  expect(plainText("  \n ")).toEqual([]);
});

test("a code block keeps its lines, without its fences nor its language", () => {
  expect(plainText("Avant :\n\n```ts\nconst a = 1;\n  return a;\n```\nAprès")).toEqual([
    "Avant :",
    "const a = 1;",
    "  return a;",
    "Après",
  ]);
});

test("a link keeps its text and its address, parentheses included", () => {
  expect(
    plainText("Voir [la maquette](https://example.com/m) et [Wiki](https://fr.wikipedia.org/wiki/Kibo_(x))"),
  ).toEqual(["Voir la maquette (https://example.com/m) et Wiki (https://fr.wikipedia.org/wiki/Kibo_(x))"]);
  expect(plainText("<https://example.com>")).toEqual(["https://example.com"]);
});

test("an image reads « [image : alt] (url) »", () => {
  expect(plainText("![plan du constat](https://example.com/p.png)")).toEqual([
    "[image : plan du constat] (https://example.com/p.png)",
  ]);
});

test("a quote stays on its own lines with « > »", () => {
  expect(plainText("Le client :\n\n> Oui pour **les photos**\n> sans les plans\n\nFin")).toEqual([
    "Le client :",
    "> Oui pour les photos",
    "> sans les plans",
    "Fin",
  ]);
});

test("a table reads one row per line, cells separated by « · »", () => {
  expect(plainText("| Taille | Prix |\n|---|---|\n| 2 Go | 5 € |\n| 5 Go | 9 € |")).toEqual([
    "Taille · Prix",
    "2 Go · 5 €",
    "5 Go · 9 €",
  ]);
});
