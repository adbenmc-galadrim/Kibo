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
  origin: CommandEvent["meta"]["origin"] = "user",
): CommandEvent => ({
  projectId: "p1",
  command,
  result,
  meta: { origin, instanceId: null },
});

type Harness = QuestionEventDeps & { messages: ChangeMessage[]; removed: string[]; woken: string[][] };

function harness(): Harness {
  const messages: ChangeMessage[] = [];
  const removed: string[] = [];
  const woken: string[][] = [];
  return {
    messages,
    removed,
    woken,
    emit: (m) => messages.push(m),
    images: { remove: (questionId) => removed.push(questionId) },
    wake: (projectId, questionId) => woken.push([projectId, questionId]),
  };
}

const ANSWER = { kind: "text", text: "5 Go" } as const;
const IMPORT = { kind: "import", ref: "csv" } as const;
const ANSWERS: ProjectCommand[] = [
  { method: "answerQuestion", questionId: "q1", answer: ANSWER, by: HUMAN },
  { method: "updateAnswer", questionId: "q1", answer: ANSWER, by: HUMAN },
];
const SILENT: ProjectCommand[] = [
  { method: "answerQuestion", questionId: "q1", answer: ANSWER, by: IMPORT },
  { method: "updateAnswer", questionId: "q1", answer: ANSWER, by: IMPORT },
  { method: "reopenQuestion", questionId: "q1", by: HUMAN },
  { method: "archiveQuestion", questionId: "q1", by: HUMAN },
  { method: "createQuestion", ticketId: "t1", title: "Quota ?", createdBy: HUMAN },
  { method: "removeQuestion", questionId: "q1" },
];

test("an answer of a human given by the user wakes the project agent once", () => {
  for (const command of ANSWERS) {
    const h = harness();
    afterQuestionCommands([eventOf(command)], h);
    expect(h.woken).toEqual([["p1", "q1"]]);
    expect(h.messages).toEqual([{ topic: "agents" }]);
  }
});

test("an imported answer, another command or another origin never wakes the project agent", () => {
  for (const command of SILENT) {
    const h = harness();
    afterQuestionCommands([eventOf(command)], h);
    expect(h.woken).toEqual([]);
    expect(h.messages).toEqual([{ topic: "agents" }]);
  }
  for (const origin of ["agent", "kibo", "sync"] as const) {
    for (const command of ANSWERS) {
      const h = harness();
      afterQuestionCommands([eventOf(command, undefined, origin)], h);
      expect(h.woken).toEqual([]);
    }
  }
});

test("without a wake port, an answer only refreshes the agents", () => {
  const messages: ChangeMessage[] = [];
  const [command] = ANSWERS;
  if (!command) throw new Error("no answer command");
  expect(() =>
    afterQuestionCommands([eventOf(command)], { emit: (m) => messages.push(m), images: null, wake: null }),
  ).not.toThrow();
  expect(messages).toEqual([{ topic: "agents" }]);
});

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
    wake: null,
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
