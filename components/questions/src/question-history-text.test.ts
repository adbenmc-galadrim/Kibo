import { expect, test } from "bun:test";
import { DEFAULT_RECIPIENTS, type Question, type QuestionAnswer, type QuestionEvent } from "@kibo/schema";
import { historyEntries, historyLine } from "./question-history-text";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const MINUTE = 60_000;
const NOW = 100 * MINUTE;
const ADAM = { kind: "human", ref: "Adam" } as const;

const answer = (option: string, delivered = false): QuestionAnswer => ({
  kind: "option",
  option,
  text: "",
  by: ADAM,
  at: 1,
  deliveredAt: delivered ? 2 : null,
  deliveredRunId: delivered ? "run-2" : null,
});

const question = (history: QuestionEvent[], over: Partial<Question> = {}): Question => ({
  kind: "question",
  images: [],
  id: "q",
  ticketId: T2,
  runId: null,
  title: "B",
  context: "",
  options: ["Oui", "Non"],
  provisional: null,
  blocking: false,
  createdBy: ADAM,
  createdAt: 1,
  number: null,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history,
  archivedAt: null,
  archivedBy: null,
  ...over,
});

const event = (
  kind: QuestionEvent["kind"],
  minutesAgo: number,
  previous: QuestionEvent["previous"] = {},
) => ({
  kind,
  at: NOW - minutesAgo * MINUTE,
  by: ADAM,
  previous,
});

const ctx = {
  recipients: [...DEFAULT_RECIPIENTS, { id: "galadrim", name: "Galadrim" }],
  members: [],
  ticketLabel: (id: string) => (id === T1 ? "KIB-1" : "KIB-2"),
  now: NOW,
};

const lines = (q: Question) => historyEntries(q).map((entry) => historyLine(entry, ctx));

test("an update lists each changed field before → after, the recipient in plain words", () => {
  const q = question([event("updated", 3, { title: "A", recipient: "galadrim", ticketId: T1 })]);
  expect(lines(q)).toEqual([
    "il y a 3 min · Adam · Modifiée (titre : « A » → « B » ; ticket : KIB-1 → KIB-2 ; destinataire : Galadrim → Client)",
  ]);
});

test("context, options and provisional choice read as replaced content and lists", () => {
  const q = question([event("updated", 1, { context: "ancien", options: ["Oui"], provisional: "Oui" })], {
    provisional: null,
  });
  expect(lines(q)).toEqual([
    "il y a 1 min · Adam · Modifiée (contenu remplacé ; options : Oui → Oui · Non ; choix provisoire : Oui → aucun)",
  ]);
});

test("a reopening cites the removed answer, never a run, even when it was marked delivered", () => {
  const q = question([event("reopened", 2, { answer: answer("Oui", true) })]);
  expect(lines(q)).toEqual(["il y a 2 min · Adam · Rouverte (réponse « Oui » retirée)"]);
  const quiet = question([event("reopened", 2, { answer: answer("Oui") })]);
  expect(lines(quiet)).toEqual(["il y a 2 min · Adam · Rouverte (réponse « Oui » retirée)"]);
});

test("an edited answer reads old → new, archive and restore are one word", () => {
  const q = question(
    [event("answer_edited", 30, { answer: answer("Oui") }), event("archived", 20), event("restored", 10)],
    { answer: answer("Non") },
  );
  expect(lines(q)).toEqual([
    "il y a 10 min · Adam · Restaurée",
    "il y a 20 min · Adam · Archivée",
    "il y a 30 min · Adam · Réponse modifiée (« Oui » → « Non »)",
  ]);
});

test("a reminder is one word", () => {
  expect(lines(question([event("reminded", 4)]))).toEqual(["il y a 4 min · Adam · Relancée"]);
  expect(lines(question([event("exported", 4)]))).toEqual(["il y a 4 min · Adam · Marquée envoyée"]);
});

test("each entry knows the state right after its event, newest first", () => {
  const q = question([event("updated", 5, { title: "A" }), event("updated", 3, { title: "B" })], {
    title: "C",
  });
  expect(lines(q)).toEqual([
    "il y a 3 min · Adam · Modifiée (titre : « B » → « C »)",
    "il y a 5 min · Adam · Modifiée (titre : « A » → « B »)",
  ]);
});
