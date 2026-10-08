import { expect, test } from "bun:test";
import { answerPrompt, deliveryPrompt, KiboError, type Question, type RunView } from "@kibo/schema";
import { answered, HUMAN, runView } from "../questions/questions.test-helper";
import {
  answerFromDrawer,
  type DeliveryDeps,
  deliverAnswers,
  deliverBlockingAnswer,
} from "./question-delivery";

type Calls = { answers: [string, string][]; marks: [string, string, string[], string][]; drawer: string[] };

function deps(runs: RunView[], undelivered: Question[] = [], blocking: Question | null = null) {
  const calls: Calls = { answers: [], marks: [], drawer: [] };
  const order: string[] = [];
  const d: DeliveryDeps = {
    runs: () => runs,
    answer(runId, text) {
      calls.answers.push([runId, text]);
      order.push("answer");
      const run = runs.find((r) => r.id === runId);
      if (!run) throw new KiboError("NOT_FOUND", runId);
      return run;
    },
    data: {
      undeliveredAnswers: () => undelivered,
      markAnswersDelivered(projectId, ticketId, ids, runId) {
        calls.marks.push([projectId, ticketId, [...ids], runId]);
        order.push("mark");
      },
      answerRunQuestion(_projectId, runId, text) {
        calls.drawer.push(`${runId}:${text}`);
        order.push("drawer");
        return blocking;
      },
    },
  };
  return { d, calls, order };
}

test("a blocking answer reaches its waiting run at once and is marked delivered", () => {
  const q = answered("q1", { blocking: true });
  const { d, calls, order } = deps([runView({ id: "r1", state: "waiting_input" })]);
  expect(deliverBlockingAnswer(d, q)).toBe(true);
  expect(calls.answers).toEqual([["r1", answerPrompt(q)]]);
  expect(calls.marks).toEqual([["p1", "t1", ["q1"], "r1"]]);
  expect(order).toEqual(["answer", "mark"]);
});

test("an answer to a question to validate, or of a run that does not wait, is never sent alone", () => {
  const done = runView({ id: "r1", state: "done" });
  for (const [q, runs] of [
    [answered("q1"), [done]],
    [answered("q2", { blocking: true }), [done]],
    [answered("q3", { blocking: true, runId: null }), [done]],
    [answered("q4", { blocking: true, runId: "gone" }), [done]],
  ] as const) {
    const { d, calls } = deps([...runs]);
    expect(deliverBlockingAnswer(d, q)).toBe(false);
    expect(calls).toEqual({ answers: [], marks: [], drawer: [] });
  }
});

test("delivering sends one message with every answer to the main session, then marks them", () => {
  const first = answered("q1", { at: 10 });
  const second = answered("q2", { at: 20 });
  for (const state of ["done", "running"] as const) {
    const { d, calls, order } = deps([runView({ id: "r1", state })], [first, second]);
    expect(deliverAnswers(d, "p1", "t1")).toEqual({ sent: 2, runId: "r1" });
    expect(calls.answers).toEqual([["r1", deliveryPrompt([first, second])]]);
    expect(calls.marks).toEqual([["p1", "t1", ["q1", "q2"], "r1"]]);
    expect(order).toEqual(["answer", "mark"]);
  }
});

test("answers of an older run go to the latest started run of the ticket", () => {
  const old = runView({ id: "r1", seq: 1 });
  const main = runView({ id: "r2", seq: 2 });
  const queued = runView({ id: "r3", seq: 3, state: "queued", startedAt: null });
  const other = runView({ id: "r4", seq: 4, ticketId: "t2" });
  const { d, calls } = deps([old, main, queued, other], [answered("q1")]);
  expect(deliverAnswers(d, "p1", "t1")).toEqual({ sent: 1, runId: "r2" });
  expect(calls.answers.map(([runId]) => runId)).toEqual(["r2"]);
});

test("a refused resume surfaces and marks nothing; no session or no answer behave plainly", () => {
  const { d, calls } = deps([runView({ id: "r1" })], [answered("q1")]);
  d.answer = () => {
    throw new KiboError("INVALID_TRANSITION", "run r1 cannot be resumed");
  };
  expect(() => deliverAnswers(d, "p1", "t1")).toThrow(
    new KiboError("INVALID_TRANSITION", "run r1 cannot be resumed"),
  );
  expect(calls.marks).toEqual([]);
  const none = deps([runView({ id: "r1", startedAt: null })], [answered("q1")]);
  expect(() => deliverAnswers(none.d, "p1", "t1")).toThrow(KiboError);
  expect(none.calls.marks).toEqual([]);
  const empty = deps([runView({ id: "r1" })], []);
  expect(deliverAnswers(empty.d, "p1", "t1")).toEqual({ sent: 0, runId: null });
  expect(empty.calls.answers).toEqual([]);
});

test("the drawer answers the open blocking question, marks it, then resumes the run", () => {
  const run = runView({ id: "r1", state: "waiting_input" });
  const q = answered("q1", { blocking: true });
  const { d, calls, order } = deps([run], [], q);
  expect(answerFromDrawer(d, run, "443", HUMAN)).toBe(run);
  expect(calls.drawer).toEqual(["r1:443"]);
  expect(calls.marks).toEqual([["p1", "t1", ["q1"], "r1"]]);
  expect(calls.answers).toEqual([["r1", "443"]]);
  expect(order).toEqual(["drawer", "mark", "answer"]);
  const bare = deps([run], [], null);
  answerFromDrawer(bare.d, run, "443", HUMAN);
  expect(bare.calls.marks).toEqual([]);
  expect(bare.calls.answers).toEqual([["r1", "443"]]);
  const running = deps([runView({ id: "r1", state: "running" })], [], q);
  answerFromDrawer(running.d, runView({ id: "r1", state: "running" }), "et les tests ?", HUMAN);
  expect(running.calls.drawer).toEqual([]);
  expect(running.calls.answers).toEqual([["r1", "et les tests ?"]]);
});
