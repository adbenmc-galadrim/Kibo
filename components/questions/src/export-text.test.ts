import { expect, test } from "bun:test";
import { byExportOrder, exportAll, exportDate, exportQuestionText, impactLine } from "./export-text";
import { question } from "./question-fixtures.test-helper";

const Q14 = question({ number: 14, blocking: true });
const Q17 = question({ number: 17, title: "Un rapport par chef de chantier ou par affaire ?" });
const TRONCONS = { feature: "Tronçons et étapes", week: "2026-10-19" };

test("the impact line names the feature by its title and the week of its sprint", () => {
  expect(impactLine(Q14, TRONCONS)).toBe(
    "bloque « Tronçons et étapes », prévue semaine du 19 oct. · réponse souhaitée avant le 19 oct.",
  );
  expect(impactLine(Q17, { feature: "Rapports", week: "2026-10-26" })).toBe(
    "pour « Rapports », prévue semaine du 26 oct. · réponse souhaitée avant le 26 oct.",
  );
  expect(impactLine(Q14, { feature: "Tronçons et étapes", week: null })).toBe(
    "bloque « Tronçons et étapes », à planifier",
  );
});

test("a question reads « Qn · title », its impact, then its context as plain text and its options", () => {
  expect(exportQuestionText({ question: Q14, impact: TRONCONS })).toBe(
    [
      "Q14 · Un ISO réaffecté garde-t-il ses photos ?",
      "   bloque « Tronçons et étapes », prévue semaine du 19 oct. · réponse souhaitée avant le 19 oct.",
    ].join("\n"),
  );
  const detailed = question({
    importRef: { kind: "import_ref", source: "plan", id: "Q5" },
    context: " Il nous faut les **clés API** du `compte`.\n\n- photos\n- plans ",
    options: ["Oui", "Non"],
    provisional: "Oui",
  });
  expect(exportQuestionText({ question: detailed, impact: { feature: "Photos", week: null } })).toBe(
    [
      "Q5 · Un ISO réaffecté garde-t-il ses photos ?",
      "   pour « Photos », à planifier",
      "   Contexte : Il nous faut les clés API du compte.",
      "   • photos",
      "   • plans",
      "   Options : Oui · Non",
      "   Choix provisoire : Oui",
    ].join("\n"),
  );
});

test("blocking questions come first, then by increasing Qn", () => {
  const q2 = question({ id: "a", number: 2 });
  const q1 = question({ id: "b", number: 1 });
  const q9 = question({ id: "c", number: 9, blocking: true });
  const q5 = question({ id: "d", importRef: { kind: "import_ref", source: "plan", id: "Q5" } });
  const unnumbered = question({ id: "e" });
  expect([q2, unnumbered, q1, q5, q9].sort(byExportOrder).map((q) => q.id)).toEqual([
    "c",
    "b",
    "a",
    "d",
    "e",
  ]);
});

test("the export starts with the recipient and the date, one blank line between questions", () => {
  const entries = [
    { question: Q14, impact: TRONCONS },
    { question: Q17, impact: { feature: "Rapports", week: null } },
  ];
  expect(exportAll("Emis SA", exportDate(Date.parse("2026-10-16T14:52:00+02:00")), entries)).toBe(
    [
      "Questions pour Emis SA · 16 oct. 2026",
      "",
      "Q14 · Un ISO réaffecté garde-t-il ses photos ?",
      "   bloque « Tronçons et étapes », prévue semaine du 19 oct. · réponse souhaitée avant le 19 oct.",
      "",
      "Q17 · Un rapport par chef de chantier ou par affaire ?",
      "   pour « Rapports », à planifier",
    ].join("\n"),
  );
});
