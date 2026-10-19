import { expect, spyOn, test } from "bun:test";
import type { ChangeMessage, ProjectCommand } from "@kibo/schema";
import type { CommandEvent } from "../docs";
import { afterQuestionCommands, type QuestionEventDeps } from "./question-events";
import { answered, HUMAN } from "./questions.test-helper";

const EDITS: ProjectCommand[] = [
  { method: "updateQuestion", questionId: "q1", by: HUMAN, title: "B" },
  { method: "updateAnswer", questionId: "q1", answer: { kind: "text", text: "x" }, by: HUMAN },
  { method: "reopenQuestion", questionId: "q1", by: HUMAN },
  { method: "archiveQuestion", questionId: "q1", by: HUMAN },
  { method: "restoreQuestion", questionId: "q1", by: HUMAN },
];

const eventOf = (
  command: ProjectCommand,
  result: unknown = answered("q1", { blocking: true }),
): CommandEvent => ({
  projectId: "p1",
  command,
  result,
  meta: { origin: "user", instanceId: null },
});

function harness(): QuestionEventDeps & { messages: ChangeMessage[]; removed: string[] } {
  const messages: ChangeMessage[] = [];
  const removed: string[] = [];
  return {
    messages,
    removed,
    emit: (m) => messages.push(m),
    images: { remove: (questionId) => removed.push(questionId) },
  };
}

test("each question edit refreshes the agents and removes no image", () => {
  for (const command of EDITS) {
    const h = harness();
    afterQuestionCommands([eventOf(command)], h);
    expect(h.messages).toEqual([{ topic: "agents" }]);
    expect(h.removed).toEqual([]);
  }
});

test("a removed question has its images removed once", () => {
  const h = harness();
  afterQuestionCommands([eventOf({ method: "removeQuestion", questionId: "q1" }, null)], h);
  expect(h.removed).toEqual(["q1"]);
  expect(h.messages).toEqual([{ topic: "agents" }]);
});

test("without an image store, a removed question only refreshes the agents", () => {
  const messages: ChangeMessage[] = [];
  afterQuestionCommands([eventOf({ method: "removeQuestion", questionId: "q1" }, null)], {
    emit: (m) => messages.push(m),
    images: null,
  });
  expect(messages).toEqual([{ topic: "agents" }]);
});

test("an answer from the user is not delivered and writes no line", () => {
  const error = spyOn(console, "error").mockImplementation(() => {});
  const h = harness();
  afterQuestionCommands(
    [
      eventOf({
        method: "answerQuestion",
        questionId: "q1",
        answer: { kind: "text", text: "5 Go" },
        by: HUMAN,
      }),
    ],
    h,
  );
  expect(h.messages).toEqual([{ topic: "agents" }]);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});
