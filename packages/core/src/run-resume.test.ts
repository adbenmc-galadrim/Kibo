import { expect, test } from "bun:test";
import type { RunRecord, RunView } from "@kibo/schema";
import { initRun } from "./run-machine";
import { canResume, isLatestOfTicket, type ResumeContext, resumableRuns } from "./run-resume";

const record = (
  id: string,
  seq: number,
  ticketId: string | null = "t1",
  kind: RunRecord["kind"] = "ticket",
): RunRecord => ({
  id,
  seq,
  projectId: "p1",
  ticketId,
  ticketKey: ticketId === null ? null : "KIB-1",
  ticketTitle: "Récepteur",
  profileId: "opus",
  profileName: "opus-dev",
  sessionId: `s-${id}`,
  brief: "",
  kind,
  resumedFrom: null,
  createdAt: 0,
});
const ended = (id: string, seq: number, ticketId: string | null = "t1"): RunView => ({
  ...initRun(record(id, seq, ticketId), 0, 0),
  state: "done",
  startedAt: 10,
  endedAt: 20,
});
const context = (runs: RunView[], p: Partial<ResumeContext> = {}): ResumeContext => ({
  runs,
  alive: () => false,
  profileIds: new Set(["opus"]),
  ...p,
});

test("only the newest run of a ticket is its latest", () => {
  const older = ended("a", 1);
  const newer = ended("b", 2);
  const elsewhere = ended("c", 3, "t2");
  const runs = [older, newer, elsewhere];
  expect(isLatestOfTicket(older, runs)).toBe(false);
  expect(isLatestOfTicket(newer, runs)).toBe(true);
  expect(isLatestOfTicket(elsewhere, runs)).toBe(true);
});

test("a finished ticket run resumes when it is the latest, its process gone and its profile kept", () => {
  const run = ended("a", 1);
  expect(canResume(run, context([run]))).toBe(true);
  expect(canResume(run, context([run, ended("b", 2)]))).toBe(false);
  expect(canResume(run, context([run], { alive: (id) => id === "a" }))).toBe(false);
  expect(canResume(run, context([run], { profileIds: new Set() }))).toBe(false);
  const task = ended("t", 1, null);
  expect(canResume(task, context([task]))).toBe(false);
  const neverStarted = { ...run, startedAt: null };
  expect(canResume(neverStarted, context([neverStarted]))).toBe(false);
  const active = { ...run, state: "running" as const };
  expect(canResume(active, context([active]))).toBe(false);
  expect(resumableRuns(context([run, ended("b", 2), ended("c", 3, "t2"), task]))).toEqual(["b", "c"]);
});

const projectRun = (id: string, seq: number, projectId = "p1"): RunView => ({
  ...initRun({ ...record(id, seq, null, "project"), projectId, profileId: "project-agent" }, 0, 0),
  state: "done",
  startedAt: 10,
  endedAt: 20,
});

test("a finished project run resumes until a newer project run of the same project exists", () => {
  const run = projectRun("a", 1);
  const profiles = { profileIds: new Set(["project-agent"]) };
  expect(canResume(run, context([run], profiles))).toBe(true);
  expect(canResume(run, context([run, projectRun("o", 2, "p2")], profiles))).toBe(true);
  expect(canResume(run, context([run, projectRun("b", 2)], profiles))).toBe(false);
  expect(canResume(run, context([run]))).toBe(false);
  const neverStarted = { ...run, state: "failed" as const, startedAt: null };
  expect(canResume(neverStarted, context([neverStarted], profiles))).toBe(true);
});
