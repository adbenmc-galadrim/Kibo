import { expect, test } from "bun:test";
import { pushEvent, QUESTION_HISTORY_MAX, QuestionEvent } from "./question-history";

const ADAM = { kind: "human", ref: "adam" } as const;

const event = (at: number): QuestionEvent =>
  QuestionEvent.parse({ kind: "updated", at, by: ADAM, previous: { title: `T${at}` } });

test("a question event records who changed what, with the previous values only", () => {
  expect(QuestionEvent.parse({ kind: "updated", at: 1, by: ADAM, previous: { title: "A" } })).toEqual({
    kind: "updated",
    at: 1,
    by: ADAM,
    previous: { title: "A" },
  });
  expect(QuestionEvent.safeParse({ kind: "deleted", at: 1, by: ADAM, previous: {} }).success).toBe(false);
  expect(
    QuestionEvent.safeParse({ kind: "reopened", at: 1, by: ADAM, previous: { answer: null } }).success,
  ).toBe(true);
  expect(QuestionEvent.safeParse({ kind: "updated", at: 1, by: ADAM, previous: { title: "" } }).success).toBe(
    false,
  );
});

test("the history keeps the last twenty events, the oldest goes first", () => {
  expect(QUESTION_HISTORY_MAX).toBe(20);
  const full = Array.from({ length: 20 }, (_, i) => event(i + 1));
  const pushed = pushEvent(full, event(21));
  expect(pushed).toHaveLength(20);
  expect(pushed[0]?.at).toBe(2);
  expect(pushed.at(-1)?.at).toBe(21);
  expect(full).toHaveLength(20);
  expect(pushEvent([], event(1))).toEqual([event(1)]);
});

test("a reminder is a question event without previous values", () => {
  expect(QuestionEvent.parse({ kind: "reminded", at: 2, by: ADAM, previous: {} }).kind).toBe("reminded");
});

test("an export is recorded in the history", () => {
  expect(QuestionEvent.parse({ kind: "exported", at: 5, by: ADAM, previous: {} }).kind).toBe("exported");
});
