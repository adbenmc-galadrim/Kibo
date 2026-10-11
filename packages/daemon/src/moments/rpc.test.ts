import { expect, test } from "bun:test";
import type { RunMomentsPage, RunPeek, RunProgressSummary, RunView } from "@kibo/schema";
import { handleVisibilityRequest } from "./rpc";
import type { TraceService } from "./trace-service";

const RUN = { id: "run-1", state: "running" } as RunView;
const SUMMARY: RunProgressSummary = { runId: "run-1", step: null, report: null };
const PEEK: RunPeek = {
  runId: "run-1",
  label: "opus-dev-1",
  profileName: "opus-dev",
  state: "running",
  ticketKey: null,
  ticketTitle: "",
  step: null,
  lastMessage: null,
  waiting: false,
};
const PAGE: RunMomentsPage = { moments: [], internalPlan: null, partial: null, source: "pending" };

const calls: unknown[] = [];
const trace = {
  page(runId: string, after?: number) {
    calls.push(["page", runId, after]);
    return PAGE;
  },
  peek(run: RunView, progress: RunProgressSummary | null) {
    calls.push(["peek", run.id, progress]);
    return { ...PEEK, runId: run.id };
  },
} as TraceService;
const agents = {
  run: (runId: string) => (runId === "run-1" ? RUN : null),
  progress: (runId: string) => (runId === "run-1" ? SUMMARY : null),
};

test("runMoments pages the stored moments of a known run", () => {
  calls.length = 0;
  expect(handleVisibilityRequest(trace, agents, { method: "runMoments", runId: "run-1", after: 3 })).toBe(
    PAGE,
  );
  expect(calls).toEqual([["page", "run-1", 3]]);
});

test("runPeek gives the card of a known run with its progress", () => {
  calls.length = 0;
  expect(handleVisibilityRequest(trace, agents, { method: "runPeek", runId: "run-1" })).toEqual(PEEK);
  expect(calls).toEqual([["peek", "run-1", SUMMARY]]);
});

test("an unknown run is NOT_FOUND and other methods are refused", () => {
  expect(() => handleVisibilityRequest(trace, agents, { method: "runMoments", runId: "x" })).toThrow(
    "NOT_FOUND",
  );
  expect(() => handleVisibilityRequest(trace, agents, { method: "runPeek", runId: "x" })).toThrow(
    "NOT_FOUND",
  );
  expect(() => handleVisibilityRequest(trace, agents, { method: "getAgents" })).toThrow("INTERNAL");
});
