import { expect, test } from "bun:test";
import {
  type Actor,
  isAnswered,
  isArchived,
  isOpen,
  KiboError,
  type ProjectCommand,
  QUESTION_HISTORY_MAX,
  Question,
} from "@kibo/schema";
import fc from "fast-check";
import { executeProjectCommand } from "./commands";
import { createProjectDoc } from "./project";
import { createQuestion, getQuestion } from "./questions";
import { createTicket } from "./tickets";

const ADAM: Actor = { kind: "human", ref: "adam" };

type Step =
  | { op: "update"; title: number; options: boolean }
  | { op: "updateAnswer" | "answer"; text: number }
  | { op: "reopen" | "archive" | "restore" };

const step: fc.Arbitrary<Step> = fc.oneof(
  fc.record({ op: fc.constant("update" as const), title: fc.nat(3), options: fc.boolean() }),
  fc.record({ op: fc.constantFrom("updateAnswer" as const, "answer" as const), text: fc.nat(3) }),
  fc.record({ op: fc.constantFrom("reopen" as const, "archive" as const, "restore" as const) }),
);

function commandOf(questionId: string, s: Step): ProjectCommand {
  const by = ADAM;
  switch (s.op) {
    case "update":
      return {
        method: "updateQuestion",
        questionId,
        by,
        title: `T${s.title}`,
        ...(s.options ? { options: ["A", "C"] } : {}),
      };
    case "answer":
      return { method: "answerQuestion", questionId, by, answer: { kind: "text", text: `R${s.text}` } };
    case "updateAnswer":
      return { method: "updateAnswer", questionId, by, answer: { kind: "text", text: `R${s.text}` } };
    case "reopen":
      return { method: "reopenQuestion", questionId, by };
    case "archive":
      return { method: "archiveQuestion", questionId, by };
    case "restore":
      return { method: "restoreQuestion", questionId, by };
  }
}

function expectLastAccepted(q: Question, s: Step): void {
  if (s.op === "archive") expect(isArchived(q)).toBe(true);
  if (s.op === "restore") expect(isArchived(q)).toBe(false);
  if (s.op === "reopen") expect(isOpen(q)).toBe(true);
  if (s.op === "answer" || s.op === "updateAnswer") expect(q.answer?.text).toBe(`R${s.text}`);
  if (s.op === "update") expect(q.title).toBe(`T${s.title}`);
}

test("any accepted edit sequence keeps a valid question, a bounded history and one state", () => {
  fc.assert(
    fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
      const doc = createProjectDoc({
        id: "p1",
        key: "KIB",
        name: "Kibo",
        folder: null,
        color: "#F97316",
        worktree: null,
        storybook: null,
        duplication: null,
        delivery: null,
      });
      const ticket = createTicket(doc, { title: "Stockage" });
      const { id } = createQuestion(doc, {
        ticketId: ticket.id,
        title: "T0",
        options: ["A", "B"],
        createdBy: ADAM,
      });
      for (const s of steps) {
        try {
          executeProjectCommand(doc, commandOf(id, s));
        } catch (error) {
          if (!(error instanceof KiboError)) throw error;
          continue;
        }
        const q = getQuestion(doc, id);
        expect(Question.safeParse(q).success).toBe(true);
        expect(q.history.length).toBeLessThanOrEqual(QUESTION_HISTORY_MAX);
        expect([isOpen(q), isAnswered(q), isArchived(q)].filter(Boolean)).toHaveLength(1);
        expectLastAccepted(q, s);
      }
    }),
    { numRuns: 60 },
  );
});
