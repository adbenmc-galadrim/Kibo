import { expect, test } from "bun:test";
import { initRun } from "@kibo/core/run-machine";
import type { RunRecord, RunView } from "@kibo/schema";
import { decideSession, sessionPreview, type TranscriptCheck } from "./session-decision";

const record = (id: string, patch: Partial<RunRecord> = {}): RunRecord => ({
  id,
  seq: 1,
  projectId: "p1",
  ticketId: "t1",
  ticketKey: "KIB-1",
  ticketTitle: "Ticket",
  profileId: "opus",
  profileName: "opus-dev",
  sessionId: `s-${id}`,
  brief: "",
  createdAt: 0,
  resumedFrom: null,
  ...patch,
});

const previous: RunView = {
  ...initRun(record("r1"), 1, 0),
  label: "opus-dev-2",
  state: "done",
  startedAt: 10,
  cwd: "/repo",
  transcriptPath: "/t/s-r1.jsonl",
  turns: 3,
  tokens: 12_000,
};
const inherited = record("r2", { sessionId: "s-r1", resumedFrom: "r1" });
const known: TranscriptCheck = (path) => path === "/t/s-r1.jsonl";
const decide = (run: RunRecord, prev: RunView | null, cwd = "/repo", exists = known) =>
  decideSession({ run, previous: prev, cwd, transcriptExists: exists, newId: () => "s-new" });

test("an inherited run resumes the session when its transcript and folder are still there", () => {
  expect(decide(inherited, previous)).toEqual({ resume: true, sessionId: "s-r1", from: "r1" });
});

test("an inherited run starts a new session with a new id when the transcript or folder is gone", () => {
  expect(decide(inherited, previous, "/repo", () => false)).toEqual({
    resume: false,
    sessionId: "s-new",
    reason: "transcript_missing",
  });
  expect(decide(inherited, { ...previous, transcriptPath: null })).toMatchObject({
    sessionId: "s-new",
    reason: "transcript_missing",
  });
  expect(decide(inherited, previous, "/elsewhere")).toEqual({
    resume: false,
    sessionId: "s-new",
    reason: "workspace_changed",
  });
});

test("a run that did not inherit keeps its own new session and says why", () => {
  const own = record("r2");
  expect(decide(own, null)).toEqual({ resume: false, sessionId: "s-r2", reason: "no_previous" });
  expect(decide(own, { ...previous, profileId: "sonnet" })).toEqual({
    resume: false,
    sessionId: "s-r2",
    reason: "profile_changed",
  });
  expect(decide(own, previous)).toEqual({ resume: false, sessionId: "s-r2", reason: "user_reset" });
});

test("the preview announces the main session and whether it can be resumed", () => {
  const check = { profileId: "opus", cwd: "/repo", transcriptExists: known };
  expect(sessionPreview(null, check)).toBeNull();
  expect(sessionPreview(previous, check)).toEqual({
    runId: "r1",
    label: "opus-dev-2",
    turns: 3,
    tokens: 12_000,
    resumable: true,
    reason: null,
  });
  expect(sessionPreview(previous, { ...check, profileId: "sonnet" })).toMatchObject({
    resumable: false,
    reason: "profile_changed",
  });
  expect(sessionPreview(previous, { ...check, transcriptExists: () => false })).toMatchObject({
    resumable: false,
    reason: "transcript_missing",
  });
  expect(sessionPreview(previous, { ...check, cwd: null })).toMatchObject({
    resumable: false,
    reason: "workspace_changed",
  });
});
