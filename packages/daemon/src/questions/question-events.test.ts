import { expect, test } from "bun:test";
import type { ChangeMessage, ProjectCommand } from "@kibo/schema";
import { fakeAgentsPort } from "../agents-port.test-helper";
import type { AgentQuestions } from "../agents-rpc";
import type { CommandEvent } from "../docs";
import { afterQuestionCommands } from "./question-events";
import { answered, HUMAN, runView } from "./questions.test-helper";

const QUESTIONS: AgentQuestions = {
  data: {
    runQuestions: () => [],
    undeliveredAnswers: () => [],
    markAnswersDelivered: () => {},
    answerRunQuestion: () => null,
  },
  projectIds: () => [],
  projectAgents: () => [],
  viewer: () => "adam",
  assertWritable: () => {},
};

const EDITS: ProjectCommand[] = [
  { method: "updateQuestion", questionId: "q1", by: HUMAN, title: "B" },
  { method: "updateAnswer", questionId: "q1", answer: { kind: "text", text: "x" }, by: HUMAN },
  { method: "reopenQuestion", questionId: "q1", by: HUMAN },
  { method: "archiveQuestion", questionId: "q1", by: HUMAN },
  { method: "restoreQuestion", questionId: "q1", by: HUMAN },
];

test("each question edit refreshes the agents and never sends an answer to a waiting run", () => {
  const blocking = answered("q1", { blocking: true });
  const agents = fakeAgentsPort([runView({ id: "r1", state: "waiting_input" })]);
  for (const command of EDITS) {
    const messages: ChangeMessage[] = [];
    const event: CommandEvent = {
      projectId: "p1",
      command,
      result: blocking,
      meta: { origin: "user", instanceId: null },
    };
    afterQuestionCommands([event], { emit: (m) => messages.push(m), agents, questions: QUESTIONS });
    expect(messages).toEqual([{ topic: "agents" }]);
  }
});
