import { expect, test } from "bun:test";
import { type Question, QuestionAnswer, resolveAnswer, type TicketView } from "@kibo/schema";
import fc from "fast-check";
import { answerFrom, filterQuestions, groupByTicket, relativeAge, viewGroups } from "./questions-logic";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const T3 = "33333333-3333-4333-8333-333333333333";

const question = (over: Partial<Question>): Question => ({
  id: "q",
  ticketId: T1,
  runId: null,
  title: "Titre",
  context: "",
  options: ["Oui", "Non"],
  provisional: "Non",
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-1" },
  createdAt: 1,
  importRef: null,
  answer: null,
  ...over,
});

const answered = (over: Partial<Question>): Question =>
  question({
    answer: {
      kind: "confirm",
      option: "Non",
      text: "",
      by: { kind: "human", ref: "adam" },
      at: 5,
      deliveredAt: null,
      deliveredRunId: null,
    },
    ...over,
  });

const ticket = (id: string, keyLabel: string): TicketView => ({
  id,
  key: keyLabel,
  pendingSeq: null,
  keyLabel,
  title: `Ticket ${keyLabel}`,
  description: "",
  statusId: "todo",
  parentId: null,
  assignee: null,
  domainId: null,
  blockedReason: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
});

test("filterQuestions keeps open, answered or all questions, optionally of one ticket", () => {
  const open = question({ id: "a" });
  const done = answered({ id: "b", ticketId: T2 });
  const all = [open, done];
  expect(filterQuestions(all, "open", null)).toEqual([open]);
  expect(filterQuestions(all, "answered", null)).toEqual([done]);
  expect(filterQuestions(all, "all", null)).toEqual(all);
  expect(filterQuestions(all, "all", T2)).toEqual([done]);
  expect(filterQuestions(all, "open", T2)).toEqual([]);
});

test("groupByTicket follows ticket keys, newest question first, and skips empty tickets", () => {
  const tickets = [ticket(T1, "KIB-10"), ticket(T2, "KIB-2"), ticket(T3, "KIB-3")];
  const old = question({ id: "old", ticketId: T1, createdAt: 1 });
  const fresh = question({ id: "fresh", ticketId: T1, createdAt: 9 });
  const other = question({ id: "other", ticketId: T2, createdAt: 4 });
  const orphan = question({ id: "orphan", ticketId: "44444444-4444-4444-8444-444444444444" });
  const groups = groupByTicket([old, other, fresh, orphan], tickets);
  expect(groups.map((g) => g.ticket.keyLabel)).toEqual(["KIB-2", "KIB-10"]);
  expect(groups[1]?.questions.map((q) => q.id)).toEqual(["fresh", "old"]);
});

test("viewGroups keeps a ticket whose answers wait for delivery even when the filter hides them", () => {
  const tickets = [ticket(T1, "KIB-1"), ticket(T2, "KIB-2"), ticket(T3, "KIB-3")];
  const open = question({ id: "open", ticketId: T1 });
  const pending = answered({ id: "pending", ticketId: T2 });
  const delivered = answered({ id: "sent", ticketId: T3 });
  const sent = {
    ...delivered,
    answer: delivered.answer && { ...delivered.answer, deliveredAt: 6, deliveredRunId: "r1" },
  };
  const groups = viewGroups([open, pending, sent], tickets, "open", null);
  expect(
    groups.map((g) => [g.ticket.keyLabel, g.questions.map((q) => q.id), g.undelivered.map((q) => q.id)]),
  ).toEqual([
    ["KIB-1", ["open"], []],
    ["KIB-2", [], ["pending"]],
  ]);
  expect(viewGroups([open, pending, sent], tickets, "open", T1).map((g) => g.ticket.id)).toEqual([T1]);
});

test("answerFrom prefers the confirmation, then the option, then the trimmed text", () => {
  expect(answerFrom({ option: "Oui", text: "x", confirm: true })).toEqual({ kind: "confirm" });
  expect(answerFrom({ option: "Oui", text: "x", confirm: false })).toEqual({ kind: "option", option: "Oui" });
  expect(answerFrom({ option: null, text: "  Jamais  ", confirm: false })).toEqual({
    kind: "text",
    text: "Jamais",
  });
  expect(answerFrom({ option: null, text: "   ", confirm: false })).toBeNull();
});

test("any answer built by the form is accepted for a question that carries its option", () => {
  const option = fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim() === s && s.length > 0);
  fc.assert(
    fc.property(
      fc.record({ option: fc.option(option, { nil: null }), text: fc.string(), confirm: fc.boolean() }),
      (form) => {
        const input = answerFrom(form);
        if (input === null) return true;
        const pick = form.option ?? "Oui";
        const q = question({ options: [...new Set([pick, "Autre"])], provisional: pick });
        const built = resolveAnswer(q, input);
        return QuestionAnswer.safeParse({ ...built, by: { kind: "human", ref: "adam" }, at: 1 }).success;
      },
    ),
  );
});

test("relativeAge reads as now, minutes, hours or days", () => {
  const now = 10 * 86_400_000;
  expect(relativeAge(now - 10_000, now)).toBe("à l'instant");
  expect(relativeAge(now - 3 * 60_000, now)).toBe("il y a 3 min");
  expect(relativeAge(now - 5 * 3_600_000, now)).toBe("il y a 5 h");
  expect(relativeAge(now - 2 * 86_400_000, now)).toBe("il y a 2 j");
});
