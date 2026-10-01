import { expect, test } from "bun:test";
import { type AgentsState, DraftStatus } from "@kibo/schema";
import { agentsFixture, runFixture } from "../agents/fixtures";
import { draftFixture } from "../ai/draft-fixtures";
import { awaitingAction, groupDrafts, indicatorState, runStatus } from "./creation-status";

const draft = (id: string, status: DraftStatus, runId: string | null = null) =>
  draftFixture({ id, status, runId });

test("awaitingAction is true for failed, review and permissions only", () => {
  const awaiting = DraftStatus.options.filter((s) => awaitingAction(draft("d", s)));
  expect(awaiting).toEqual(["failed", "review", "permissions"]);
});

test("groupDrafts splits active and finished drafts and keeps the received order", () => {
  const list = [
    draft("a", "review"),
    draft("b", "done"),
    draft("c", "generating"),
    draft("d", "abandoned"),
    draft("e", "describing"),
  ];
  const { active, finished } = groupDrafts(list);
  expect(active.map((d) => d.id)).toEqual(["a", "c", "e"]);
  expect(finished.map((d) => d.id)).toEqual(["b", "d"]);
});

test("indicatorState: hidden without active draft, busy while a run generates, counts awaiting drafts", () => {
  expect(indicatorState([], [])).toEqual({ visible: false, awaiting: 0, busy: false });
  const running = runFixture({ id: "r1", state: "running" });
  expect(indicatorState([draft("a", "generating", "r1")], [running])).toEqual({
    visible: true,
    awaiting: 0,
    busy: true,
  });
  const queued = runFixture({ id: "r2", state: "queued" });
  expect(indicatorState([draft("a", "generating", "r2")], [queued])).toEqual({
    visible: true,
    awaiting: 0,
    busy: false,
  });
  expect(indicatorState([draft("a", "review")], [])).toEqual({ visible: true, awaiting: 1, busy: false });
  expect(indicatorState([draft("a", "validating")], [])).toMatchObject({ busy: true });
  expect(indicatorState([draft("a", "done"), draft("b", "abandoned")], [])).toEqual({
    visible: false,
    awaiting: 0,
    busy: false,
  });
});

test("runStatus reads the queue position, a running run, a question, and nothing otherwise", () => {
  const state: AgentsState = {
    ...agentsFixture(),
    runs: [
      runFixture({ id: "q", state: "queued" }),
      runFixture({ id: "r", state: "starting" }),
      runFixture({ id: "w", state: "waiting_input" }),
      runFixture({ id: "f", state: "failed" }),
    ],
    queue: [{ runId: "q", position: 2, reason: null }],
  };
  expect(runStatus(draft("a", "generating", "q"), state)).toEqual({ kind: "queued", position: 2 });
  expect(runStatus(draft("a", "generating", "r"), state)).toEqual({ kind: "running" });
  expect(runStatus(draft("a", "generating", "w"), state)).toEqual({ kind: "waiting" });
  expect(runStatus(draft("a", "failed", "f"), state)).toBeNull();
  expect(runStatus(draft("a", "generating", "x"), state)).toBeNull();
  expect(runStatus(draft("a", "generating", null), state)).toBeNull();
  expect(runStatus(draft("a", "generating", "q"), null)).toBeNull();
});
