import { describe, expect, test } from "bun:test";
import type { ProjectSnapshot } from "@kibo/schema";
import { fakeSnapshot } from "../commands/tickets-test-kit";
import { fakeQuestion, QUESTIONS, RECIPIENTS } from "./question-test-kit";
import { findQuestion, summarizeQuestions } from "./question-view";

const ANSWERED = fakeQuestion({
  id: "q3",
  number: 3,
  title: "Quelle couleur ?",
  options: ["Rouge", "Bleu"],
  provisional: "Bleu",
  answer: { kind: "option", option: "Rouge", text: "" },
});
const OTHER_TICKET = fakeQuestion({ id: "q9", number: 9, ticketId: "b" });

const snapshot = (): ProjectSnapshot => ({
  ...fakeSnapshot(),
  questions: [ANSWERED, ...QUESTIONS, OTHER_TICKET],
  questionRecipients: RECIPIENTS,
});

describe("summarizeQuestions", () => {
  test("lists the non archived questions of the ticket, by number", () => {
    expect(summarizeQuestions(snapshot(), "a", false)).toEqual([
      {
        id: "q1",
        number: 1,
        ticket: "SILO-33",
        title: "Quel format ?",
        state: "open",
        blocking: true,
        recipient: { id: "r-client", name: "client" },
        options: ["A", "B"],
        provisional: null,
        answer: null,
        createdAt: 1_793_000_000_000,
      },
      {
        id: "q3",
        number: 3,
        ticket: "SILO-33",
        title: "Quelle couleur ?",
        state: "answered",
        blocking: false,
        recipient: { id: "me", name: "moi" },
        options: ["Rouge", "Bleu"],
        provisional: "Bleu",
        answer: "Rouge",
        createdAt: 1_793_000_000_000,
      },
    ]);
  });

  test("--all adds the archived ones", () => {
    const all = summarizeQuestions(snapshot(), "a", true);
    expect(all.map((q) => [q.id, q.state])).toEqual([
      ["q1", "open"],
      ["q2", "archived"],
      ["q3", "answered"],
    ]);
  });

  test("a text answer gives its text", () => {
    const text = fakeQuestion({ id: "q4", number: 4, answer: { kind: "text", text: "Libre", option: null } });
    const [only] = summarizeQuestions({ ...snapshot(), questions: [text] }, "a", false);
    expect(only?.answer).toBe("Libre");
  });

  test("questions without number come after, by creation date", () => {
    const late = fakeQuestion({ id: "q-late", number: null, createdAt: 2 });
    const early = fakeQuestion({ id: "q-early", number: null, createdAt: 1 });
    const ids = summarizeQuestions({ ...snapshot(), questions: [late, early, ...QUESTIONS] }, "a", false).map(
      (q) => q.id,
    );
    expect(ids).toEqual(["q1", "q-early", "q-late"]);
  });

  test("the recipient defaults to me, then to its id when unknown", () => {
    const unknown = fakeQuestion({ id: "q5", number: 5, recipient: "r-gone" });
    const bare = { ...snapshot(), questions: [unknown, ANSWERED], questionRecipients: [] };
    expect(summarizeQuestions(bare, "a", false).map((q) => q.recipient)).toEqual([
      { id: "me", name: "moi" },
      { id: "r-gone", name: "r-gone" },
    ]);
  });
});

describe("findQuestion", () => {
  const questions = [ANSWERED, ...QUESTIONS, fakeQuestion({ id: "3", number: 7 })];

  test("finds by number first", () => {
    expect(findQuestion(questions, "3")?.id).toBe("q3");
    expect(findQuestion(questions, "#1")?.id).toBe("q1");
  });

  test("then by id", () => {
    expect(findQuestion(questions, "q2")?.id).toBe("q2");
    expect(findQuestion(questions, "nope")).toBeNull();
  });
});
