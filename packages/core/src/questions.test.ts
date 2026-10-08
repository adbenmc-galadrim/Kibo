import { expect, test } from "bun:test";
import { type Actor, KiboError, Question } from "@kibo/schema";
import fc from "fast-check";
import { executeProjectCommand, readProject } from "./commands";
import { createProjectDoc } from "./project";
import {
  answerQuestion,
  createQuestion,
  listQuestions,
  type NewQuestion,
  openQuestionCount,
  removeQuestion,
} from "./questions";
import { createTicket, deleteTicket } from "./tickets";

const AGENT: Actor = { kind: "agent", ref: "emis-livraison" };
const HUMAN: Actor = { kind: "human", ref: "adam" };

const newProjectDoc = (key: string) =>
  createProjectDoc({ id: "p1", key, name: "Kibo", folder: null, color: "#F97316", worktree: null });

const stored = (ticketId: string) => ({
  id: "q",
  ticketId,
  runId: null,
  title: "Q",
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: HUMAN,
  createdAt: 1,
  importRef: null,
  answer: null,
});

test("questions live in the project doc, dedupe on open title, answer once, and die with their ticket", () => {
  const doc = newProjectDoc("KIB");
  const t = createTicket(doc, { title: "Stockage S3" });
  const sameInput: NewQuestion = {
    ticketId: t.id,
    title: "Bloquer le dépôt ?",
    options: ["Oui", "Non"],
    provisional: "Non",
    blocking: false,
    runId: "r1",
    createdBy: AGENT,
    at: 1,
  };
  const q = createQuestion(doc, sameInput);
  expect(createQuestion(doc, { ...sameInput, title: "  Bloquer le dépôt ?  ", at: 2 }).id).toBe(q.id);
  expect(listQuestions(doc)).toHaveLength(1);
  expect(readProject(doc).tickets[0]?.openQuestions).toBe(1);
  const answered = answerQuestion(doc, q.id, { kind: "confirm" }, HUMAN, 3);
  expect(answered.answer).toEqual({ kind: "confirm", option: "Non", text: "", by: HUMAN, at: 3 });
  expect(() => answerQuestion(doc, q.id, { kind: "text", text: "x" }, HUMAN, 4)).toThrow(
    new KiboError("INVALID_TRANSITION", `question ${q.id} is already answered`),
  );
  expect(readProject(doc).tickets[0]?.openQuestions).toBe(0);
  expect(readProject(doc).questions).toEqual([answered]);
  expect(createQuestion(doc, { ...sameInput, at: 5 }).id).not.toBe(q.id);
  expect(() => createQuestion(doc, { ...sameInput, ticketId: "nope" })).toThrow(KiboError);
  deleteTicket(doc, t.id);
  expect(listQuestions(doc)).toEqual([]);
});

test("a question takes the defaults, refuses what the schema refuses, and is removed by id", () => {
  const doc = newProjectDoc("KIB");
  const t = createTicket(doc, { title: "Stockage S3" });
  const q = createQuestion(doc, { ticketId: t.id, title: "Quel port ?", createdBy: HUMAN, at: 7 });
  expect(q).toMatchObject({
    context: "",
    options: [],
    provisional: null,
    blocking: false,
    runId: null,
    importRef: null,
    answer: null,
    createdAt: 7,
  });
  expect(() =>
    createQuestion(doc, {
      ticketId: t.id,
      title: "Autre",
      options: ["A"],
      provisional: "B",
      createdBy: HUMAN,
    }),
  ).toThrow(KiboError);
  expect(() => answerQuestion(doc, q.id, { kind: "confirm" }, HUMAN, 8)).toThrow(KiboError);
  removeQuestion(doc, q.id);
  expect(listQuestions(doc)).toEqual([]);
  expect(() => removeQuestion(doc, q.id)).toThrow(new KiboError("NOT_FOUND", `question ${q.id} not found`));
  expect(() => answerQuestion(doc, q.id, { kind: "text", text: "x" }, HUMAN, 9)).toThrow(KiboError);
});

test("a ticket holds 500 questions at most", () => {
  const doc = newProjectDoc("KIB");
  const t = createTicket(doc, { title: "Stockage S3" });
  const map = doc.getMap("questions");
  for (let i = 0; i < 500; i++) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    map.set(id, Question.parse({ ...stored(t.id), id, title: `Q${i}` }));
  }
  doc.commit();
  expect(() => createQuestion(doc, { ticketId: t.id, title: "Une de trop", createdBy: HUMAN })).toThrow(
    new KiboError("QUOTA_EXCEEDED", `ticket ${t.id} already has 500 questions`),
  );
});

test("a corrupt question is reported, never silently dropped", () => {
  const doc = newProjectDoc("KIB");
  doc.getMap("questions").set("bad", { id: "bad", title: "" });
  doc.commit();
  expect(() => listQuestions(doc)).toThrow(new KiboError("STORE_CORRUPT", "invalid question bad"));
});

test("the three commands dispatch to the doc", () => {
  const doc = newProjectDoc("KIB");
  const t = createTicket(doc, { title: "Stockage S3" });
  const created = executeProjectCommand(doc, {
    method: "createQuestion",
    ticketId: t.id,
    title: "Quel port ?",
    options: ["80", "443"],
    createdBy: HUMAN,
  });
  const q = Question.parse(created);
  const answered = Question.parse(
    executeProjectCommand(doc, {
      method: "answerQuestion",
      questionId: q.id,
      answer: { kind: "option", option: "443" },
      by: HUMAN,
      at: 4,
    }),
  );
  expect(answered.answer).toEqual({ kind: "option", option: "443", text: "", by: HUMAN, at: 4 });
  expect(executeProjectCommand(doc, { method: "removeQuestion", questionId: q.id })).toBeNull();
  expect(listQuestions(doc)).toEqual([]);
});

type Step =
  | { op: "create"; ticket: number; title: number }
  | { op: "answer"; pick: number }
  | { op: "remove"; pick: number };

const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ op: fc.constant("create" as const), ticket: fc.nat(2), title: fc.nat(4) }),
  fc.record({ op: fc.constant("answer" as const), pick: fc.nat(20) }),
  fc.record({ op: fc.constant("remove" as const), pick: fc.nat(20) }),
);

function play(doc: ReturnType<typeof newProjectDoc>, ticketIds: string[], s: Step): void {
  const all = listQuestions(doc);
  const target = s.op === "create" ? undefined : all[s.pick % Math.max(all.length, 1)];
  if (s.op === "create") {
    const ticketId = ticketIds[s.ticket] ?? "";
    createQuestion(doc, { ticketId, title: `Q${s.title}`, createdBy: AGENT });
  } else if (target && s.op === "answer" && target.answer === null) {
    answerQuestion(doc, target.id, { kind: "text", text: "ok" }, HUMAN, 1);
  } else if (target && s.op === "remove") {
    removeQuestion(doc, target.id);
  }
}

test("the open count of each ticket always matches the unanswered questions", () => {
  fc.assert(
    fc.property(fc.array(step, { maxLength: 30 }), (steps) => {
      const doc = newProjectDoc("KIB");
      const ticketIds = ["A", "B", "C"].map((title) => createTicket(doc, { title }).id);
      for (const s of steps) play(doc, ticketIds, s);
      const questions = listQuestions(doc);
      return readProject(doc).tickets.every((t) => {
        const open = questions.filter((q) => q.ticketId === t.id && q.answer === null).length;
        return t.openQuestions === open && openQuestionCount(doc, t.id) === open;
      });
    }),
    { numRuns: 60 },
  );
});
