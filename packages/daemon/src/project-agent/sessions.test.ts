import { expect, test } from "bun:test";
import { run } from "@kibo/core/project-agent/test-kit";
import { ASK_TOOL, type ProjectAgentSession, type RunLogEntry, WAKEUP_PREFIX } from "@kibo/schema";
import { answered, asked, exited } from "./run-log.test-helper";
import {
  currentRun,
  memoryText,
  pastSessions,
  projectOfRun,
  rejectionMessage,
  sessionDigest,
  summaryOf,
  withDigest,
} from "./sessions";

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

test("the digest names the agent by Adam's first question and counts the exchange", () => {
  const log: RunLogEntry[] = [
    answered(1, `${WAKEUP_PREFIX} 1 réponse à lire.`),
    exited(2, "Je propose :"),
    answered(3, "  Fais le point du jour  "),
    exited(4, "F3 est livrée."),
    answered(5, "Et F5 ?"),
    { id: 6, at: 6, event: { type: "failed", error: "INTERRUPTED" } },
  ];
  expect(sessionDigest(log)).toEqual({ title: "Fais le point du jour", messages: 4 });
  expect(sessionDigest([])).toEqual({ title: null, messages: 0 });
  expect(
    sessionDigest([answered(1, `${WAKEUP_PREFIX} 2 signaux à traiter.`), exited(2, "Je propose :")]),
  ).toEqual({ title: null, messages: 1 });
  expect(sessionDigest([answered(1, "x".repeat(200))]).title).toBe(`${"x".repeat(119)}…`);
});

test("an agent question counts once; a failed or empty exit and another tool do not count", () => {
  const log = [
    answered(1, "Où en est-on ?"),
    asked(2, ASK_TOOL, "Quel sprint ?"),
    asked(3, ASK_TOOL, null),
    asked(4, "mcp__kibo__list_tickets", "ignored"),
    exited(5, null),
    exited(6, "boom", 1),
  ];
  expect(sessionDigest(log)).toEqual({ title: "Où en est-on ?", messages: 2 });
});

test("a session view adds the digest of its log to the stored session", () => {
  expect(withDigest(session("r1"), [answered(1, "Relances client")])).toEqual({
    ...session("r1"),
    title: "Relances client",
    messages: 1,
  });
});
