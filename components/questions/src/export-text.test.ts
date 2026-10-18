import { expect, test } from "bun:test";
import { exportAll, exportDate, exportQuestionText, impactLine } from "./export-text";
import { question } from "./question-fixtures.test-helper";

const Q14 = question({ number: 14, blocking: true });
const Q17 = question({ number: 17, title: "Un rapport par chef de chantier ou par affaire ?" });

test("the impact line names the feature and its sprint", () => {
  expect(impactLine(Q14, { feature: "F6", sprint: "S43" })).toBe("bloque F6, prévue en S43");
  expect(impactLine(Q17, { feature: "F7", sprint: "S44" })).toBe("pour F7, prévue en S44");
  expect(impactLine(Q14, { feature: "F6", sprint: null })).toBe("bloque F6, à planifier");
});

test("a question reads « Qn · title », its impact, then its context and options", () => {
  expect(exportQuestionText({ question: Q14, impact: { feature: "F6", sprint: "S43" } })).toBe(
    ["Q14 · Un ISO réaffecté garde-t-il ses photos ?", "   bloque F6, prévue en S43"].join("\n"),
  );
  const detailed = question({
    importRef: { kind: "import_ref", source: "plan", id: "Q5" },
    context: " Les photos suivent l'ISO. ",
    options: ["Oui", "Non"],
    provisional: "Oui",
  });
  expect(exportQuestionText({ question: detailed, impact: { feature: "EMIS-9", sprint: null } })).toBe(
    [
      "Q5 · Un ISO réaffecté garde-t-il ses photos ?",
      "   pour EMIS-9, à planifier",
      "   Contexte : Les photos suivent l'ISO.",
      "   Options : Oui · Non",
      "   Choix provisoire : Oui",
    ].join("\n"),
  );
});

test("the export starts with the recipient and the date, one blank line between questions", () => {
  const entries = [
    { question: Q14, impact: { feature: "F6", sprint: "S43" } },
    { question: Q17, impact: { feature: "F7", sprint: "S44" } },
  ];
  expect(exportAll("Emis SA", exportDate(Date.parse("2026-10-16T14:52:00+02:00")), entries)).toBe(
    [
      "Questions pour Emis SA · 16 oct. 2026",
      "",
      "Q14 · Un ISO réaffecté garde-t-il ses photos ?",
      "   bloque F6, prévue en S43",
      "",
      "Q17 · Un rapport par chef de chantier ou par affaire ?",
      "   pour F7, prévue en S44",
    ].join("\n"),
  );
});
