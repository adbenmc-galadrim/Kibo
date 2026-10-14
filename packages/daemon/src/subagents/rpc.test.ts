import { expect, test } from "bun:test";
import type { RunMomentsPage, RunSubagent } from "@kibo/schema";
import { handleSubagentRequest } from "./rpc";

const SUBAGENT: RunSubagent = {
  id: "a1",
  runId: "run-1",
  toolUseId: "toolu_1",
  type: "Explore",
  description: "Repérage",
  prompt: "Cherche",
  model: null,
  state: "running",
  startedAt: 1,
  endedAt: null,
  result: null,
  actions: 2,
  parentId: null,
  transcriptPath: null,
};
const PAGE: RunMomentsPage = { moments: [], internalPlan: null, partial: null, source: "transcript" };
const calls: unknown[] = [];
const deps = {
  store: {
    list: (runId: string) => (runId === "run-1" ? [SUBAGENT] : []),
    find: (id: string) => (id === "a1" ? SUBAGENT : null),
  },
  trace: {
    subagentPage(runId: string, subagentId: string, after?: number) {
      calls.push([runId, subagentId, after]);
      return PAGE;
    },
  },
  run: (runId: string) => (runId === "run-1" || runId === "run-2" ? { id: runId } : null),
};

test("runs.subagents lists the subagents of a run", () => {
  expect(handleSubagentRequest(deps, { method: "runs.subagents", runId: "run-1" })).toEqual([SUBAGENT]);
});

test("runs.subagentMoments pages the moments of one subagent", () => {
  const req = { method: "runs.subagentMoments" as const, runId: "run-1", subagentId: "a1", after: 4 };
  expect(handleSubagentRequest(deps, req)).toBe(PAGE);
  expect(calls).toEqual([["run-1", "a1", 4]]);
});

test("an unknown run or a subagent of another run is not found", () => {
  expect(() => handleSubagentRequest(deps, { method: "runs.subagents", runId: "nope" })).toThrow(
    expect.objectContaining({ code: "NOT_FOUND" }),
  );
  const other = { method: "runs.subagentMoments" as const, runId: "run-2", subagentId: "a1" };
  expect(() => handleSubagentRequest(deps, other)).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
});
