import { expect, test } from "bun:test";
import type { Question, QuestionAnswer } from "@kibo/schema";
import {
  firstOpenQuestion,
  previewAge,
  previewExcerpt,
  previewState,
  ticketPreviewRows,
} from "./question-preview-text";

const T1 = "t1";

const question = (over: Partial<Question>): Question => ({
  kind: "question",
  images: [],
  id: "q",
  ticketId: T1,
  runId: null,
  title: "Titre",
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-1" },
  createdAt: 1,
  importRef: null,
  answer: null,
  recipient: "me",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  ...over,
});

const answer = (over: Partial<QuestionAnswer> = {}): QuestionAnswer => ({
  kind: "text",
  option: null,
  text: "Oui",
  by: { kind: "human", ref: "adam" },
  at: 2,
  deliveredAt: null,
  deliveredRunId: null,
  ...over,
});

test("previewExcerpt strips the Markdown marks and cuts at the last whole word", () => {
  expect(previewExcerpt("**Gras** et `code`\n\n- un [lien](https://x.y) dans une liste\n1. deux", 200)).toBe(
    "Gras et code un lien dans une liste deux",
  );
  expect(previewExcerpt("# Titre\n> cité", 200)).toBe("Titre cité");
  expect(previewExcerpt("un deux trois quatre", 12)).toBe("un deux…");
  expect(previewExcerpt("", 200)).toBe("");
});

test("previewState reads open, answered to deliver, answered or delivered to a run", () => {
  const runLabel = (id: string) => (id === "r2" ? "opus-dev-2" : id);
  expect(previewState(question({}), runLabel)).toBe("ouverte");
  expect(previewState(question({ answer: answer() }), runLabel)).toBe("répondue · à transmettre");
  expect(previewState(question({ answer: answer({ by: { kind: "import", ref: "plan" } }) }), runLabel)).toBe(
    "répondue",
  );
  expect(previewState(question({ answer: answer({ deliveredAt: 3, deliveredRunId: "r2" }) }), runLabel)).toBe(
    "transmise à opus-dev-2",
  );
  expect(
    previewState(question({ archivedAt: 4, archivedBy: { kind: "human", ref: "adam" } }), runLabel),
  ).toBe("archivée");
});

test("ticketPreviewRows keeps five open questions of the ticket, oldest first, and counts the rest", () => {
  const qs = [
    ...[7, 3, 5, 1, 6, 2, 4].map((n) => question({ id: `q${n}`, createdAt: n })),
    question({ id: "answered", createdAt: 0, answer: answer() }),
    question({ id: "other", ticketId: "t2", createdAt: 0 }),
  ];
  const { rows, more } = ticketPreviewRows(qs, T1);
  expect(rows.map((q) => q.id)).toEqual(["q1", "q2", "q3", "q4", "q5"]);
  expect(more).toBe(2);
  expect(ticketPreviewRows(qs, "t3")).toEqual({ rows: [], more: 0 });
  expect(firstOpenQuestion(qs, T1)).toBe("q1");
  expect(firstOpenQuestion(qs, "t3")).toBeNull();
});

test("previewAge reads now, minutes, hours or days", () => {
  const now = 10 * 24 * 3_600_000;
  expect(previewAge(now - 10_000, now)).toBe("à l'instant");
  expect(previewAge(now - 5 * 60_000, now)).toBe("il y a 5 min");
  expect(previewAge(now - 3 * 3_600_000, now)).toBe("il y a 3 h");
  expect(previewAge(now - 2 * 24 * 3_600_000, now)).toBe("il y a 2 j");
});
