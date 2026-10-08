import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Question, RunEvent } from "@kibo/schema";
import { fakeCalls } from "./fake-claude-scenario";
import {
  assign,
  cleanHarness,
  type Harness,
  profile,
  run,
  setup,
  waitUntil,
} from "./orchestrator.test-helper";

cleanHarness();

const repoProfiles = [
  profile({ workspace: "repo" }),
  profile({ id: "sonnet", name: "sonnet-dev", workspace: "repo" }),
];

function inRepo(extra: { questions?: Question[]; markFails?: boolean } = {}) {
  const meta = { folder: "" };
  const h = setup({ scenario: "done", profiles: repoProfiles, meta, ...extra });
  meta.folder = join(h.home, "repo");
  mkdirSync(meta.folder);
  return { h, meta };
}

const finished = async (h: Harness, id: string) => {
  await waitUntil(() => run(h, id).state === "done");
  return run(h, id);
};
const events = (h: Harness, id: string): RunEvent[] => h.orch.log(id).map((e) => e.event);
const sessionEvent = (h: Harness, id: string) => events(h, id).find((e) => e.type === "session");
const spawnedEvent = (h: Harness, id: string) => events(h, id).find((e) => e.type === "spawned");
const flagOf = (argv: string[]) => argv.find((a) => a === "--resume" || a === "--session-id");

test("a second assignment of a ticket inherits the main session of the same profile", async () => {
  const { h } = inRepo();
  const first = await finished(h, assign(h, "t1").id);
  const second = assign(h, "t1");
  expect(second.sessionId).toBe(first.sessionId);
  expect(second.resumedFrom).toBe(first.id);
  await finished(h, second.id);
  const calls = fakeCalls(h.state, first.sessionId);
  expect(calls.map((c) => flagOf(c.argv))).toEqual(["--session-id", "--resume"]);
  expect(sessionEvent(h, second.id)).toEqual({ type: "session", mode: "resumed", from: first.id });
  expect(sessionEvent(h, first.id)).toEqual({ type: "session", mode: "fresh", reason: "no_previous" });
  expect(spawnedEvent(h, second.id)).toMatchObject({ resume: true });
  expect(spawnedEvent(h, second.id)).not.toHaveProperty("sessionId");
  expect(run(h, second.id)).toMatchObject({ sessionId: first.sessionId, session: { mode: "resumed" } });
}, 30_000);

test("the inherited run is the only resumable run of the ticket", async () => {
  const { h } = inRepo();
  const first = await finished(h, assign(h, "t1").id);
  expect(h.orch.state().resumable).toEqual([first.id]);
  const second = await finished(h, assign(h, "t1").id);
  expect(h.orch.state().resumable).toEqual([second.id]);
  expect(() => h.orch.answer(first.id, "suite")).toThrow("INVALID_TRANSITION");
}, 30_000);

test("another profile or a reset starts a fresh main session from the assignment", async () => {
  const { h } = inRepo();
  const first = await finished(h, assign(h, "t1").id);
  const other = assign(h, "t1", "sonnet");
  expect(other.sessionId).not.toBe(first.sessionId);
  expect(other.resumedFrom).toBeNull();
  await finished(h, other.id);
  expect(sessionEvent(h, other.id)).toEqual({ type: "session", mode: "fresh", reason: "profile_changed" });
  expect(fakeCalls(h.state, other.sessionId).map((c) => flagOf(c.argv))).toEqual(["--session-id"]);

  const reset = assign(h, "t1", "sonnet", true);
  expect(reset.sessionId).not.toBe(other.sessionId);
  expect(reset.resumedFrom).toBeNull();
  await finished(h, reset.id);
  expect(sessionEvent(h, reset.id)).toEqual({ type: "session", mode: "fresh", reason: "user_reset" });
  expect(fakeCalls(h.state, other.sessionId)).toHaveLength(1);
}, 30_000);

test("a missing transcript gives a new session id at launch, never a resume of an unknown session", async () => {
  const { h } = inRepo();
  const first = await finished(h, assign(h, "t1").id);
  expect(first.transcriptPath).not.toBeNull();
  rmSync(first.transcriptPath ?? "");
  rmSync(join(h.state, `${first.sessionId}.calls.jsonl`));
  const second = assign(h, "t1");
  expect(second.sessionId).toBe(first.sessionId);
  const done = await finished(h, second.id);
  expect(done.sessionId).not.toBe(first.sessionId);
  expect(spawnedEvent(h, second.id)).toMatchObject({ resume: false, sessionId: done.sessionId });
  expect(sessionEvent(h, second.id)).toEqual({
    type: "session",
    mode: "fresh",
    reason: "transcript_missing",
  });
  expect(fakeCalls(h.state, first.sessionId)).toEqual([]);
  expect(fakeCalls(h.state, done.sessionId).map((c) => flagOf(c.argv))).toEqual(["--session-id"]);
  expect(h.orch.answer(second.id, "encore").sessionId).toBe(done.sessionId);
  await waitUntil(() => run(h, second.id).state === "done" && run(h, second.id).turns === 2);
  expect(fakeCalls(h.state, done.sessionId).map((c) => flagOf(c.argv))).toEqual(["--session-id", "--resume"]);
}, 30_000);

test("another folder for the ticket starts a fresh session", async () => {
  const { h, meta } = inRepo();
  const first = await finished(h, assign(h, "t1").id);
  meta.folder = join(h.home, "moved");
  mkdirSync(meta.folder);
  const second = await finished(h, assign(h, "t1").id);
  expect(second.sessionId).not.toBe(first.sessionId);
  expect(sessionEvent(h, second.id)).toEqual({ type: "session", mode: "fresh", reason: "workspace_changed" });
  expect(fakeCalls(h.state, first.sessionId)).toHaveLength(1);
}, 30_000);

const answered = (id: string, title: string, text: string, at: number): Question => ({
  id,
  ticketId: "t1",
  runId: null,
  title,
  context: "",
  options: [],
  provisional: null,
  blocking: false,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: 1,
  importRef: null,
  answer: {
    kind: "text",
    option: null,
    text,
    by: { kind: "human", ref: "adam" },
    at,
    deliveredAt: null,
    deliveredRunId: null,
  },
});

test("spawned marks the ticket's undelivered answers as delivered by this run", async () => {
  const questions = [
    answered("q2", "Bloquer le dépôt ?", "Non", 20),
    answered("q1", "Accès admin ?", "Oui", 10),
  ];
  const { h } = inRepo({ questions });
  const first = await finished(h, assign(h, "t1").id);
  expect(h.delivered).toEqual([{ ticketId: "t1", questionIds: ["q1", "q2"], runId: first.id }]);
  const brief = readFileSync(join(h.home, "runs", first.id, "brief.md"), "utf8");
  expect(brief).toContain("## Questions");
  expect(brief).toContain("Oui");
  expect(brief).toContain("Non");
  h.orch.answer(first.id, "encore");
  await waitUntil(() => run(h, first.id).state === "done" && run(h, first.id).turns === 2);
  expect(h.delivered).toHaveLength(1);
}, 30_000);

test("a refused delivery mark is logged and the run goes on", async () => {
  const { h } = inRepo({ questions: [answered("q1", "Accès admin ?", "Oui", 10)], markFails: true });
  const r = await finished(h, assign(h, "t1").id);
  expect(r.error).toBeNull();
  expect(h.delivered).toEqual([]);
}, 30_000);

test("the preview offers to resume the main session, unless the transcript is gone", async () => {
  const { h } = inRepo();
  const target = { projectId: "p1", ticketId: "t1" };
  expect(h.orch.preview({ ...target, profileId: "opus" }).session).toBeNull();
  const first = await finished(h, assign(h, "t1").id);
  expect(h.orch.preview({ ...target, profileId: "opus" }).session).toEqual({
    runId: first.id,
    label: first.label,
    turns: 1,
    tokens: first.tokens,
    resumable: true,
    reason: null,
  });
  expect(h.orch.preview({ ...target, profileId: "sonnet" }).session).toMatchObject({
    reason: "profile_changed",
  });
  rmSync(first.transcriptPath ?? "");
  expect(h.orch.preview({ ...target, profileId: "opus" }).session).toMatchObject({
    resumable: false,
    reason: "transcript_missing",
  });
}, 30_000);
