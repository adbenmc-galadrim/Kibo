import { describe, expect, test } from "bun:test";
import type { MomentData, Question, RunMoment } from "@kibo/schema";
import { NOW, runFixture } from "../../agents/fixtures";
import { buildTimeline, questionExtras, segmentsOf, ticketRuns } from "./timeline";

const MIN = 60_000;

const moment = (runId: string, seq: number, at: number, data: MomentData): RunMoment => ({
  id: seq,
  runId,
  seq,
  at,
  stepId: null,
  data,
});

const say = (text: string): MomentData => ({ kind: "message", text });

const question = (patch: Partial<Question> & Pick<Question, "id" | "createdAt">): Question => ({
  kind: "question",
  images: [],
  ticketId: "t14",
  runId: null,
  title: "Quel port ?",
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-2" },
  number: null,
  importRef: null,
  answer: null,
  recipient: "me",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  ...patch,
});

const first = runFixture({
  id: "r1",
  ticketId: "t14",
  state: "done",
  createdAt: NOW - 60 * MIN,
  startedAt: NOW - 60 * MIN,
  endedAt: NOW - 50 * MIN,
});
const second = runFixture({
  id: "r2",
  ticketId: "t14",
  state: "waiting_input",
  createdAt: NOW - 20 * MIN,
  startedAt: NOW - 20 * MIN,
});

describe("buildTimeline", () => {
  test("merges run bounds, moments and questions by date", () => {
    const moments = new Map([
      ["r1", [moment("r1", 1, NOW - 58 * MIN, say("a")), moment("r1", 2, NOW - 52 * MIN, say("b"))]],
      ["r2", [moment("r2", 1, NOW - 15 * MIN, say("c"))]],
    ]);
    const q = question({ id: "q1", runId: "r1", createdAt: NOW - 55 * MIN });
    const items = buildTimeline([second, first], moments, [q]);
    expect(items.map((i) => [i.kind, i.runId])).toEqual([
      ["run-start", "r1"],
      ["moment", "r1"],
      ["question", "r1"],
      ["moment", "r1"],
      ["run-end", "r1"],
      ["run-start", "r2"],
      ["moment", "r2"],
    ]);
    expect(items[2]?.question).toBe(q);
    expect(items[0]?.run).toBe(first);
  });

  test("a run without loaded moments keeps only its bounds", () => {
    const items = buildTimeline([first], new Map(), []);
    expect(items.map((i) => i.kind)).toEqual(["run-start", "run-end"]);
    expect(items[1]?.at).toBe(NOW - 50 * MIN);
  });

  test("reasoning is left out", () => {
    const moments = new Map([
      ["r1", [moment("r1", 1, NOW - 58 * MIN, { kind: "reasoning", text: "secret" })]],
    ]);
    expect(buildTimeline([first], moments, []).some((i) => i.kind === "moment")).toBe(false);
  });

  test("equal dates keep the input order", () => {
    const at = NOW - 55 * MIN;
    const moments = new Map([["r1", [moment("r1", 1, at, say("x")), moment("r1", 2, at, say("y"))]]]);
    const items = buildTimeline([first], moments, [question({ id: "q1", createdAt: at })]);
    expect(items.map((i) => i.moment?.seq ?? i.question?.id ?? i.kind)).toEqual([
      "run-start",
      1,
      2,
      "q1",
      "run-end",
    ]);
  });

  test("a run not started yet starts at its creation", () => {
    const queued = runFixture({ id: "r3", ticketId: "t14", state: "queued", createdAt: NOW - 2 * MIN });
    expect(buildTimeline([queued], new Map(), [])).toEqual([
      { at: NOW - 2 * MIN, kind: "run-start", runId: "r3", run: queued },
    ]);
  });
});

describe("segmentsOf", () => {
  test("splits the timeline at each run start", () => {
    const early = question({
      id: "q0",
      createdAt: NOW - 90 * MIN,
      createdBy: { kind: "human", ref: "adam" },
    });
    const items = buildTimeline([first, second], new Map(), [early]);
    const segments = segmentsOf(items);
    expect(segments.map((s) => [s.run?.id ?? null, s.items.length])).toEqual([
      [null, 1],
      ["r1", 2],
      ["r2", 1],
    ]);
  });

  test("a moment dated before its run start stays in its run", () => {
    const moments = new Map([["r2", [moment("r2", 1, NOW - 40 * MIN, say("early"))]]]);
    const segments = segmentsOf(buildTimeline([first, second], moments, []));
    expect(segments.map((s) => s.items.map((i) => i.kind))).toEqual([
      ["run-start", "run-end"],
      ["moment", "run-start"],
    ]);
  });
});

describe("ticketRuns", () => {
  test("keeps the runs of the ticket, oldest first", () => {
    const other = runFixture({ id: "r9", ticketId: "t9", createdAt: NOW });
    expect(ticketRuns([second, other, first], "t14").map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("questionExtras", () => {
  test("an agent question and its answer become exchange lines", () => {
    const q = question({
      id: "q1",
      createdAt: NOW - 30 * MIN,
      answer: {
        kind: "text",
        option: null,
        text: "Port 4747",
        by: { kind: "human", ref: "adam" },
        at: NOW - 25 * MIN,
        deliveredAt: null,
        deliveredRunId: null,
      },
    });
    const items = buildTimeline([], new Map(), [q]);
    expect(questionExtras(items)).toEqual([
      { key: "q-q1", at: NOW - 30 * MIN, kind: "question", text: "Quel port ?", questionId: "q1" },
      { key: "a-q1", at: NOW - 25 * MIN, kind: "human", text: "Port 4747" },
    ]);
  });

  test("a question asked by a person is a plain line", () => {
    const q = question({ id: "q2", createdAt: NOW, createdBy: { kind: "human", ref: "adam" } });
    expect(questionExtras(buildTimeline([], new Map(), [q]))[0]?.kind).toBe("system");
  });
});

test("a signal moment enters the chronology, reasoning stays out", () => {
  const signal: MomentData = {
    kind: "signal",
    signalId: "s1",
    ref: "sig:1",
    signalKind: "ticket",
    title: "Tests",
  };
  const moments = new Map([
    [
      "r1",
      [
        moment("r1", 1, NOW - 58 * MIN, signal),
        moment("r1", 2, NOW - 57 * MIN, { kind: "reasoning", text: "…" }),
      ],
    ],
  ]);
  const items = buildTimeline([first], moments, []);
  expect(items.filter((i) => i.kind === "moment").map((i) => i.moment?.data.kind)).toEqual(["signal"]);
});
