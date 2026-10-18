import { expect, test } from "bun:test";
import {
  DEFAULT_RECIPIENTS,
  EMPTY_PROGRESS,
  type Question,
  QuestionAnswer,
  resolveAnswer,
  type TicketView,
} from "@kibo/schema";
import fc from "fast-check";
import {
  answerFrom,
  blockingSummary,
  canArchive,
  filterQuestions,
  groupByTicket,
  recipientCounts,
  recipientName,
  relativeAge,
  scopeFor,
  viewGroups,
} from "./questions-logic";

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const T3 = "33333333-3333-4333-8333-333333333333";

const question = (over: Partial<Question>): Question => ({
  kind: "question",
  images: [],
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
  number: null,
  importRef: null,
  answer: null,
  recipient: "me",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
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
  startable: false,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
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

test("filterQuestions keeps one recipient, or all of them for « Tous »", () => {
  const me = question({ id: "a" });
  const client = question({ id: "b", recipient: "client" });
  const done = answered({ id: "c", recipient: "client" });
  const all = [me, client, done];
  expect(filterQuestions(all, "open", null, null)).toEqual([me, client]);
  expect(filterQuestions(all, "open", null, "client")).toEqual([client]);
  expect(filterQuestions(all, "all", null, "client")).toEqual([client, done]);
  expect(filterQuestions(all, "open", T2, "client")).toEqual([]);
});

test("recipientCounts counts the open questions of each recipient and their total", () => {
  const all = [
    question({ id: "a" }),
    question({ id: "b", recipient: "client" }),
    question({ id: "c", recipient: "client" }),
    question({ id: "d", recipient: "gone" }),
    answered({ id: "e", recipient: "product" }),
  ];
  const counts = recipientCounts(all);
  expect(counts.total).toBe(4);
  expect([...counts.byRecipient]).toEqual([
    ["me", 1],
    ["client", 2],
    ["gone", 1],
  ]);
  expect(recipientCounts([])).toEqual({ total: 0, byRecipient: new Map() });
});

test("recipientName reads the name of a recipient, « (supprimé) » once it is gone", () => {
  expect(recipientName(DEFAULT_RECIPIENTS, "client")).toBe("Client");
  expect(recipientName([...DEFAULT_RECIPIENTS, { id: "x1", name: "Design" }], "x1")).toBe("Design");
  expect(recipientName(DEFAULT_RECIPIENTS, "x1")).toBe("(supprimé)");
});

test("the client recipient reads as the client of the project when it is set", () => {
  expect(recipientName(DEFAULT_RECIPIENTS, "client", "Emis SA")).toBe("Emis SA");
  expect(recipientName(DEFAULT_RECIPIENTS, "client", null)).toBe("Client");
  expect(recipientName(DEFAULT_RECIPIENTS, "product", "Emis SA")).toBe("Produit");
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

test("viewGroups puts open blocking questions first, then ticket keys, and renders no empty group", () => {
  const tickets = [ticket(T1, "KIB-1"), ticket(T2, "KIB-2"), ticket(T3, "KIB-3")];
  const plain = question({ id: "plain", ticketId: T1 });
  const blocking = question({ id: "blocking", ticketId: T2, blocking: true, createdAt: 1 });
  const newer = question({ id: "newer", ticketId: T2, createdAt: 9 });
  const pending = answered({ id: "pending", ticketId: T3, blocking: true });
  const groups = viewGroups([plain, blocking, newer, pending], tickets, "open", null);
  expect(groups.map((g) => [g.ticket.keyLabel, g.questions.map((q) => q.id)])).toEqual([
    ["KIB-2", ["blocking", "newer"]],
    ["KIB-1", ["plain"]],
  ]);
  expect(viewGroups([plain, blocking], tickets, "open", T1).map((g) => g.ticket.id)).toEqual([T1]);
});

test("blockingSummary counts the open blocking questions shown and the open ones", () => {
  const shown = [
    question({ id: "a", blocking: true }),
    question({ id: "b" }),
    answered({ id: "c", blocking: true }),
  ];
  expect(blockingSummary(shown)).toEqual({ blocking: 1, open: 2 });
});

test("viewGroups filtered by recipient keeps only that recipient's questions", () => {
  const tickets = [ticket(T1, "KIB-1"), ticket(T2, "KIB-2")];
  const mine = question({ id: "mine", ticketId: T1 });
  const theirs = question({ id: "theirs", ticketId: T2, recipient: "client" });
  const groups = viewGroups([mine, theirs], tickets, "open", null, "client");
  expect(groups.map((g) => [g.ticket.keyLabel, g.questions.map((q) => q.id)])).toEqual([
    ["KIB-2", ["theirs"]],
  ]);
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

const ARCHIVED = { archivedAt: 9, archivedBy: { kind: "human", ref: "adam" } } as const;

test("« Archivées » keeps archived questions only, and no other scope shows them", () => {
  const qs = [question({ id: "o" }), answered({ id: "a" }), question({ id: "x", ...ARCHIVED })];
  const ids = (scope: Parameters<typeof filterQuestions>[1]) =>
    filterQuestions(qs, scope, null).map((q) => q.id);
  expect(ids("archived")).toEqual(["x"]);
  expect(ids("all")).toEqual(["o", "a"]);
  expect(ids("open")).toEqual(["o"]);
  expect(ids("answered")).toEqual(["a"]);
  expect(viewGroups(qs, [ticket(T1, "KIB-1")], "archived", null)[0]?.questions.map((q) => q.id)).toEqual([
    "x",
  ]);
});

test("scopeFor opens « Archivées » for an archived question, « Toutes » otherwise", () => {
  expect(scopeFor(question({ ...ARCHIVED }))).toBe("archived");
  expect(scopeFor(answered({}))).toBe("all");
  expect(scopeFor(question({}))).toBe("all");
});

test("canArchive follows the author rule and spares an open question of an active run", () => {
  const mine = question({ createdBy: { kind: "human", ref: "adam" } });
  const run = (state: "running" | "done") => ({
    ticketId: T1,
    runId: "r",
    label: "opus",
    state,
    position: null,
  });
  expect(canArchive(mine, "adam", null)).toBe(true);
  expect(canArchive(mine, "lea", null)).toBe(false);
  expect(canArchive(question({}), "adam", null)).toBe(false);
  expect(canArchive(answered({}), "lea", null)).toBe(true);
  expect(canArchive(question({ ...ARCHIVED }), "adam", null)).toBe(false);
  expect(canArchive({ ...mine, runId: "r" }, "adam", run("running"))).toBe(false);
  expect(canArchive({ ...mine, runId: "r" }, "adam", run("done"))).toBe(true);
  expect(canArchive(answered({ runId: "r" }), "adam", run("running"))).toBe(true);
});
