import { expect, test } from "bun:test";
import type { RunView } from "@kibo/schema";
import { noticeFor, stdoutNotifier } from "./notifier";

const run = (p: Partial<RunView>): RunView => ({
  id: "r1",
  seq: 41,
  projectId: "p1",
  ticketId: "t1",
  ticketKey: "KIB-14",
  ticketTitle: "Récepteur de hooks",
  profileId: "opus",
  profileName: "opus-dev",
  sessionId: "s1",
  brief: "",
  createdAt: 0,
  label: "opus-dev-2",
  state: "running",
  lane: 2,
  priority: false,
  rank: 0,
  question: null,
  pendingAnswer: null,
  lastActivity: null,
  subagents: [],
  workspace: null,
  guidelines: 0,
  transcriptPath: null,
  tokens: 0,
  costUsd: 0,
  denied: [],
  error: null,
  output: null,
  stateSince: 0,
  startedAt: null,
  endedAt: null,
  turns: 1,
  ...p,
});

test("notifies a question, an end and a failure, once", () => {
  expect(
    noticeFor("running", run({ state: "waiting_input", question: "Quel port pour le récepteur ?" })),
  ).toEqual({
    title: "opus-dev-2 attend une réponse",
    body: "KIB-14 · Quel port pour le récepteur ?",
  });
  expect(noticeFor("running", run({ state: "done" }))).toEqual({
    title: "opus-dev-2 a terminé",
    body: "KIB-14 · Récepteur de hooks",
  });
  expect(noticeFor("running", run({ state: "failed", error: "exit code 1" }))).toEqual({
    title: "opus-dev-2 a échoué",
    body: "KIB-14 · exit code 1",
  });
  expect(noticeFor("running", run({ state: "done", ticketKey: null, ticketTitle: "Générer" }))?.body).toBe(
    "Générer",
  );
  expect(noticeFor("done", run({ state: "done" }))).toBeNull();
  expect(noticeFor("queued", run({ state: "starting" }))).toBeNull();
});

test("the stdout line stays on one line", () => {
  const lines: string[] = [];
  stdoutNotifier((l) => lines.push(l))({ title: "a", body: "b\nc" });
  expect(lines).toEqual(['KIBO_NOTIFY {"title":"a","body":"b\\nc"}\n']);
});
