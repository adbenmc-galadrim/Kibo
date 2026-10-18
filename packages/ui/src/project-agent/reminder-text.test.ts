import { expect, test } from "bun:test";
import { reminderText } from "./reminder-text";
import { trackingProject } from "./tracking-fixtures";

const project = () => {
  const base = trackingProject();
  return {
    ...base,
    tickets: base.tickets.map((t) => (t.shortKey === "F5" ? { ...t, effectiveSprintId: "s42" } : t)),
  };
};

test("a reminder reads as the client export: question and feature titles and the week, no Qn, F<n> nor S<n>", () => {
  const base = project();
  const blocking = {
    ...base,
    questions: base.questions.map((q) => (q.id === "q-logo" ? { ...q, blocking: true } : q)),
  };
  expect(reminderText(blocking, "q-logo")).toBe(
    [
      "Bonjour,",
      "Je reviens vers vous au sujet de « Client - Logo ? »",
      "Elle bloque « Import des factures », prévue semaine du 12 oct. · réponse souhaitée avant le 12 oct.",
      "Pourriez-vous nous répondre ? Merci.",
    ].join("\n"),
  );
});

test("a question that does not block says what it is for; an unplanned feature is « à planifier »", () => {
  const base = project();
  const loose = {
    ...base,
    questions: base.questions.map((q) => (q.id === "q-port" ? { ...q, blocking: false } : q)),
  };
  expect(reminderText(loose, "q-port")?.split("\n")[2]).toBe(
    "Elle est posée pour « Export CSV », à planifier",
  );
});

test("an unknown question has no reminder", () => {
  expect(reminderText(project(), "nope")).toBeNull();
});
