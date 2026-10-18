import { expect, test } from "bun:test";
import { reminderText } from "./reminder-text";
import { trackingProject } from "./tracking-fixtures";

const project = () => trackingProject();

test("a reminder names the question, the feature it holds and its sprint, ready to paste", () => {
  const base = project();
  const blocking = {
    ...base,
    questions: base.questions.map((q) => (q.id === "q-logo" ? { ...q, blocking: true } : q)),
  };
  expect(reminderText(blocking, "q-logo")).toBe(
    [
      "Bonjour,",
      "Je reviens vers vous au sujet de Q14 · Client - Logo ?",
      "Elle bloque F5 · Import des factures, prévue en S42.",
      "Pourriez-vous nous répondre ? Merci.",
    ].join("\n"),
  );
});

test("a question that does not block says what it concerns; an unplanned feature has no sprint", () => {
  const base = project();
  const loose = {
    ...base,
    questions: base.questions.map((q) => (q.id === "q-port" ? { ...q, blocking: false } : q)),
  };
  expect(reminderText(loose, "q-port")?.split("\n")[2]).toBe("Elle concerne F9 · Export CSV.");
});

test("an unknown question has no reminder", () => {
  expect(reminderText(project(), "nope")).toBeNull();
});
