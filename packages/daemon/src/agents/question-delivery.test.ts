import { expect, test } from "bun:test";
import type { Question, RunView } from "@kibo/schema";
import { answered, HUMAN, runView } from "../questions/questions.test-helper";
import { answerFromDrawer, type DeliveryDeps, deliverAnswers } from "./question-delivery";

type Calls = { answers: [string, string][]; marks: [string, string, string[], string][]; drawer: string[] };

function deps(runs: RunView[], blocking: Question | null = null) {
  const calls: Calls = { answers: [], marks: [], drawer: [] };
  const d: DeliveryDeps = {
    answer(runId, text) {
      calls.answers.push([runId, text]);
      return runs.find((r) => r.id === runId) ?? runView({ id: runId });
    },
    data: {
      undeliveredAnswers: () => [],
      markAnswersDelivered(projectId, ticketId, ids, runId) {
        calls.marks.push([projectId, ticketId, [...ids], runId]);
      },
      answerRunQuestion(_projectId, runId, text) {
        calls.drawer.push(`${runId}:${text}`);
        return blocking;
      },
    },
  };
  return { d, calls };
}

test("delivering answers or answering a ticket run is refused first", () => {
  const run = runView({ id: "r1", state: "waiting_input" });
  const { d, calls } = deps([run], answered("q1", { blocking: true }));
  expect(() => deliverAnswers()).toThrow("AGENT_EXECUTION_REMOVED");
  expect(() => answerFromDrawer(d, run, "443", HUMAN)).toThrow("AGENT_EXECUTION_REMOVED");
  expect(calls).toEqual({ answers: [], marks: [], drawer: [] });
});

test("a waiting project run is answered from the drawer", () => {
  const project = runView({ id: "pa1", state: "waiting_input", kind: "project", ticketId: null });
  const { d, calls } = deps([project]);
  expect(answerFromDrawer(d, project, "oui", HUMAN)).toBe(project);
  expect(calls).toEqual({ answers: [["pa1", "oui"]], marks: [], drawer: ["pa1:oui"] });
});
