import { Database } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { KiboError, type ProjectEventInput, ProjectMeta, Ticket } from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { createService } from "../service";
import { openStore } from "../store";
import { cleanupTmp, tmp } from "../testing/git-test-kit";
import { startT3 } from "./bootstrap";
import { createT3Runner, type T3Runner, T3Timeout } from "./t3-cli";
import { type FakeT3, installFakeT3 } from "./testing/t3-kit";

let fake: FakeT3;
beforeEach(() => {
  fake = installFakeT3();
});
afterEach(() => {
  fake.stop();
  cleanupTmp();
});

const T0 = 1_760_000_000_000;

function setup(opts: { folder?: string | null; bin?: string; run?: T3Runner } = {}) {
  const service = createService(openStore(tmp()), { user: "adam" });
  const folder = opts.folder === undefined ? "/w/silo" : opts.folder;
  const project = ProjectMeta.parse(
    service.handle({ method: "createProject", name: "Silo", key: "SILO", folder, color: "#336699" }),
  );
  const create = (title: string) =>
    Ticket.parse(
      service.handle({
        method: "command",
        projectId: project.id,
        command: { method: "createTicket", title, parentId: null },
      }),
    );
  const ticket = create("Envoyer les photos");
  const blocker = create("Avant");
  service.handle({
    method: "command",
    projectId: project.id,
    command: { method: "addLink", from: blocker.id, to: ticket.id, type: "blocks" },
  });
  const events: ProjectEventInput[] = [];
  const emitted: unknown[] = [];
  const clock = { now: T0 };
  const t3 = startT3({
    db: new Database(":memory:", { strict: true }),
    service,
    clock: { now: () => clock.now },
    sink: { record: (_p, event) => events.push(event) },
    emit: (message) => emitted.push(message),
    bin: opts.bin ?? fake.bin,
    ...(opts.run && { run: opts.run }),
  });
  const key = ticket.key ?? "";
  const rpc = (req: Parameters<typeof t3.rpc.handle>[0], ctx = LOCAL_CONTEXT) => t3.rpc.handle(req, ctx);
  const onTicket = { projectId: project.id, ticketKey: key };
  return { project, ticket, blocker, key, onTicket, events, emitted, clock, t3, rpc };
}

const starts = () => fake.calls().filter((args) => args[1] === "start");

const refusal = async (work: Promise<unknown>): Promise<string> => {
  const error = await work.catch((e: unknown) => e);
  return error instanceof KiboError ? error.code : `not refused: ${String(error)}`;
};

test("preview returns the command and the startability warning without calling t3", async () => {
  const s = setup();
  const preview = await s.rpc({ method: "t3.preview", ...s.onTicket });
  expect(preview).toMatchObject({
    folder: "/w/silo",
    argv: [
      fake.bin,
      "thread",
      "start",
      "/w/silo",
      `/full-delivery ${s.key}`,
      "--title",
      `${s.key} · Envoyer les photos`,
      "--json",
    ],
    command: `${fake.bin} thread start /w/silo "/full-delivery ${s.key}" --title "${s.key} · Envoyer les photos" --json`,
  });
  expect((preview as { warning: string }).warning).toContain("attend");
  expect(fake.calls()).toEqual([]);
});

test("launch runs thread start with the project folder and stores the thread", async () => {
  const s = setup();
  const launched = await s.rpc({ method: "t3.launch", ...s.onTicket });
  expect(starts()).toEqual([
    [
      "thread",
      "start",
      "/w/silo",
      `/full-delivery ${s.key}`,
      "--title",
      `${s.key} · Envoyer les photos`,
      "--json",
    ],
  ]);
  expect(launched).toMatchObject({
    thread: { threadId: "thr_1", link: "t3-thread://v2/fake/thr_1", status: "running", startedAt: T0 },
  });
  expect(await s.rpc({ method: "t3.threadOf", ...s.onTicket })).toMatchObject({ threadId: "thr_1" });
  expect(s.t3.activity(s.project.id).get(s.ticket.id)?.threadId).toBe("thr_1");
  expect(s.emitted).toContainEqual({ projectId: s.project.id });
  s.t3.stop();
});

test("launch on a ticket with an active thread raises T3_THREAD_ACTIVE", async () => {
  const s = setup();
  await s.rpc({ method: "t3.launch", ...s.onTicket });
  expect(await refusal(s.rpc({ method: "t3.launch", ...s.onTicket }))).toBe("T3_THREAD_ACTIVE");
  expect(starts()).toHaveLength(1);
  s.t3.stop();
});

test("two simultaneous launches start a single thread", async () => {
  const s = setup();
  const outcomes = await Promise.allSettled([
    s.rpc({ method: "t3.launch", ...s.onTicket }),
    s.rpc({ method: "t3.launch", ...s.onTicket }),
  ]);
  expect(outcomes.map((o) => o.status).sort()).toEqual(["fulfilled", "rejected"]);
  expect(starts()).toHaveLength(1);
  s.t3.stop();
});

test("launch without project folder raises PROJECT_FOLDER_MISSING", async () => {
  const s = setup({ folder: null });
  expect(await refusal(s.rpc({ method: "t3.launch", ...s.onTicket }))).toBe("PROJECT_FOLDER_MISSING");
  expect(fake.calls()).toEqual([]);
});

test("a failing start raises T3_FAILED and records nothing", async () => {
  const real = createT3Runner(fake.bin);
  const run: T3Runner = async (args, opts) => {
    if (args[1] === "start") fake.set({ mode: "server-down" });
    return real(args, opts);
  };
  const s = setup({ run });
  expect(await refusal(s.rpc({ method: "t3.launch", ...s.onTicket }))).toBe("T3_FAILED");
  expect(await s.rpc({ method: "t3.threadOf", ...s.onTicket })).toBeNull();
  expect(s.events).toEqual([]);
});

test("a failing snapshot raises T3_UNAVAILABLE and starts nothing", async () => {
  const s = setup();
  fake.set({ mode: "server-down" });
  expect(await refusal(s.rpc({ method: "t3.launch", ...s.onTicket }))).toBe("T3_UNAVAILABLE");
  expect(starts()).toEqual([]);
});

const orphanOf = (s: { key: string }, threadId: string) => ({
  threadId,
  title: `${s.key} · Envoyer les photos`,
  status: "completed",
  link: `t3-thread://${threadId}`,
  project: "/w/silo",
});

test("an orphan of the same title present before the launch is not adopted", async () => {
  const s = setup();
  fake.set({ threads: [orphanOf(s, "orphan")], startOutput: "not json", startDropsThread: true });
  const error = await s.rpc({ method: "t3.launch", ...s.onTicket }).catch((e: unknown) => e);
  expect(error).toMatchObject({
    code: "T3_FAILED",
    detail: expect.stringContaining("may have been created"),
  });
  expect(await s.rpc({ method: "t3.threadOf", ...s.onTicket })).toBeNull();
  expect(s.events).toEqual([]);
});

test("beside an orphan, the thread created by the launch is the one found back", async () => {
  const s = setup();
  fake.set({ threads: [orphanOf(s, "orphan")], nextId: "thr_new", startOutput: "not json" });
  expect(await s.rpc({ method: "t3.launch", ...s.onTicket })).toMatchObject({
    thread: { threadId: "thr_new" },
  });
  s.t3.stop();
});

test("two candidates of the same title adopt none and raise T3_FAILED", async () => {
  const real = createT3Runner(fake.bin);
  const s0: { key: string } = { key: "" };
  const run: T3Runner = async (args, opts) => {
    const result = await real(args, opts);
    if (args[1] === "start") fake.set({ threads: [orphanOf(s0, "one"), orphanOf(s0, "two")] });
    return result;
  };
  const s = setup({ run });
  s0.key = s.key;
  fake.set({ startOutput: "not json", startDropsThread: true });
  const error = await s.rpc({ method: "t3.launch", ...s.onTicket }).catch((e: unknown) => e);
  expect(error).toMatchObject({
    code: "T3_FAILED",
    detail: expect.stringContaining("a thread may have been created in T3"),
  });
  expect(await s.rpc({ method: "t3.threadOf", ...s.onTicket })).toBeNull();
});

test("status reports missing and server-down, cached 30 s", async () => {
  expect(await setup({ bin: "/nonexistent/t3" }).rpc({ method: "t3.status" })).toEqual({
    available: false,
    reason: "missing",
    bin: "/nonexistent/t3",
  });
  const s = setup();
  expect(await s.rpc({ method: "t3.status" })).toEqual({ available: true, bin: fake.bin });
  fake.set({ mode: "server-down" });
  const down = { available: false, reason: "server-down", bin: fake.bin };
  expect(await s.rpc({ method: "t3.status" })).toEqual(down);
  const before = fake.calls().length;
  fake.set({ mode: "ok" });
  s.clock.now += 29_000;
  expect(await s.rpc({ method: "t3.status" })).toEqual(down);
  expect(fake.calls()).toHaveLength(before);
  s.clock.now += 2_000;
  expect(await s.rpc({ method: "t3.status" })).toEqual({ available: true, bin: fake.bin });
});

test("status probes with a command independent of the current folder", async () => {
  const s = setup();
  expect(await s.rpc({ method: "t3.status" })).toEqual({ available: true, bin: fake.bin });
  expect(fake.calls()).toEqual([["theme", "show"]]);
});

test("an unreadable start output finds the thread back by its title and stores it", async () => {
  const s = setup();
  fake.set({ startOutput: "not json" });
  const launched = await s.rpc({ method: "t3.launch", ...s.onTicket });
  expect(launched).toMatchObject({ thread: { threadId: "thr_1", link: "t3-thread://v2/fake/thr_1" } });
  expect(fake.calls().map((args) => args[1])).toEqual(["list", "start", "list"]);
  expect(s.events.map((e) => e.kind)).toEqual(["t3_started"]);
  s.t3.stop();
});

test("a start over its timeout finds the thread back too", async () => {
  const real = createT3Runner(fake.bin);
  const run: T3Runner = async (args, opts) => {
    const result = await real(args, opts);
    if (args[1] === "start") throw new T3Timeout(1);
    return result;
  };
  const s = setup({ run });
  expect(await s.rpc({ method: "t3.launch", ...s.onTicket })).toMatchObject({
    thread: { threadId: "thr_1" },
  });
  s.t3.stop();
});

test("a thread not found back raises T3_FAILED saying one may exist, and records nothing", async () => {
  const s = setup();
  fake.set({ startOutput: "not json", startDropsThread: true });
  const error = await s.rpc({ method: "t3.launch", ...s.onTicket }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(KiboError);
  expect(error).toMatchObject({
    code: "T3_FAILED",
    detail: expect.stringContaining("may have been created"),
  });
  expect(await s.rpc({ method: "t3.threadOf", ...s.onTicket })).toBeNull();
});

test("a finished thread of the same title is not taken for the new one", async () => {
  const s = setup();
  await s.rpc({ method: "t3.launch", ...s.onTicket });
  fake.set({ threads: fake.state().threads.map((t) => ({ ...t, status: "completed" })) });
  await s.rpc({ method: "t3.refresh", projectId: s.project.id });
  fake.set({ startOutput: "not json", startDropsThread: true });
  expect(await refusal(s.rpc({ method: "t3.launch", ...s.onTicket }))).toBe("T3_FAILED");
});

test("a launch writes a t3_started project event", async () => {
  const s = setup();
  await s.rpc({ method: "t3.launch", ...s.onTicket });
  expect(s.events).toMatchObject([
    {
      kind: "t3_started",
      ticketId: s.ticket.id,
      featureId: s.ticket.id,
      data: { threadId: "thr_1", ticketKey: s.key },
    },
  ]);
  s.t3.stop();
});

test("refresh reads the list on demand and returns the checked threads", async () => {
  const s = setup();
  await s.rpc({ method: "t3.launch", ...s.onTicket });
  fake.set({ threads: fake.state().threads.map((t) => ({ ...t, status: "completed" })) });
  expect(await s.rpc({ method: "t3.refresh", projectId: s.project.id })).toMatchObject([
    { threadId: "thr_1", status: "done" },
  ]);
  expect(s.events.map((e) => e.kind)).toEqual(["t3_started", "t3_finished"]);
  s.t3.stop();
});

test("a remote session cannot use t3", async () => {
  const s = setup();
  const remote = { sessionHash: "x", remote: true };
  expect(await refusal(s.rpc({ method: "t3.status" }, remote))).toBe("FORBIDDEN");
  expect(fake.calls()).toEqual([]);
});
