import { expect, test } from "bun:test";
import type { Question } from "@kibo/schema";
import { exportAll, exportQuestionText } from "./export-text";

const ticket = { keyLabel: "KIB-12", title: "Schéma Loro des tickets" };

const question = (over: Partial<Question>): Question => ({
  kind: "question",
  images: [],
  id: "11111111-1111-4111-8111-111111111111",
  ticketId: "22222222-2222-4222-8222-222222222222",
  runId: null,
  title: "Faut-il garder l'historique des tickets supprimés ?",
  context: "Aujourd'hui un ticket supprimé disparaît.",
  options: ["Oui, corbeille de 30 jours", "Non"],
  provisional: "Non",
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-1" },
  createdAt: 1,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  ...over,
});

test("exportQuestionText follows the fixed format, line by line", () => {
  expect(exportQuestionText(question({}), ticket, "Client")).toBe(
    [
      "[KIB-12] Schéma Loro des tickets",
      "Question : Faut-il garder l'historique des tickets supprimés ?",
      "Contexte : Aujourd'hui un ticket supprimé disparaît.",
      "Options : Oui, corbeille de 30 jours · Non",
      "Choix provisoire : Non",
      "Destinataire : Client",
    ].join("\n"),
  );
});

test("an empty context, no options and no provisional choice are omitted", () => {
  expect(
    exportQuestionText(question({ context: "  ", options: [], provisional: null }), ticket, "Produit"),
  ).toBe(
    [
      "[KIB-12] Schéma Loro des tickets",
      "Question : Faut-il garder l'historique des tickets supprimés ?",
      "Destinataire : Produit",
    ].join("\n"),
  );
});

test("exportAll separates the questions by an empty line", () => {
  const a = { question: question({ title: "A ?" }), ticket, recipient: "Client" };
  const b = {
    question: question({ title: "B ?", context: "", options: [], provisional: null }),
    ticket: { keyLabel: "KIB-16", title: "Moteur de règles" },
    recipient: "Client",
  };
  expect(exportAll([a, b])).toBe(
    `${exportQuestionText(a.question, a.ticket, a.recipient)}\n\n${exportQuestionText(b.question, b.ticket, b.recipient)}`,
  );
  expect(exportAll([])).toBe("");
});
