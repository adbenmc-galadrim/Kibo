import { expect, test } from "bun:test";
import { run } from "@kibo/core/project-agent/test-kit";
import type { ProjectAgentSession } from "@kibo/schema";
import { currentRun, memoryText, pastSessions, projectOfRun, rejectionMessage, summaryOf } from "./sessions";

const session = (runId: string, closedAt: number | null = null): ProjectAgentSession => ({
  projectId: "p1",
  runId,
  sessionId: `s-${runId}`,
  startedAt: 1,
  closedAt,
  lastTurnAt: null,
});

test("the current run is the run of the session, when the orchestrator still knows it", () => {
  const runs = [run({ id: "r1", kind: "project" }), run({ id: "r2" })];
  expect(currentRun(session("r1"), runs)?.id).toBe("r1");
  expect(currentRun(session("gone"), runs)).toBeNull();
  expect(currentRun(null, runs)).toBeNull();
});

test("a summary carries the run state and the pending batch; an unknown run gives none", () => {
  const runs = [run({ id: "r1", kind: "project", state: "running" })];
  expect(summaryOf(session("r1"), runs, "b1")).toEqual({
    projectId: "p1",
    runId: "r1",
    state: "running",
    pendingBatchId: "b1",
  });
  expect(summaryOf(session("gone"), runs, null)).toBeNull();
});

test("memory, past sessions and the rejection message", () => {
  expect(memoryText(null)).toBe("");
  expect(memoryText("# Mémoire")).toBe("# Mémoire");
  expect(pastSessions([session("r2"), session("r1", 5)]).map((s) => s.runId)).toEqual(["r1"]);
  expect(rejectionMessage(3, "pas encore")).toBe("Lot 3 refusé : pas encore");
});

test("only a project run with a project names its project", () => {
  expect(projectOfRun(run({ id: "r1", kind: "project" }))).toBe("p1");
  expect(() => projectOfRun(run({ id: "r2" }))).toThrow("not a project run");
  expect(() => projectOfRun(run({ id: "r3", kind: "project", projectId: null }))).toThrow(
    expect.objectContaining({ code: "INVALID_INPUT" }),
  );
});
