import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import {
  type ChangeMessage,
  KiboError,
  type ProjectEventInput,
  ProjectMeta,
  SESSION_TIMEOUT_MS,
  Ticket,
  type TicketView,
} from "@kibo/schema";
import { LOCAL_CONTEXT } from "../rpc-extensions";
import { call, createService } from "../service";
import { openStore } from "../store";
import { cleanupTmp, git, repo, tmp } from "../testing/git-test-kit";
import { startTicketSessions } from "./bootstrap";

afterEach(cleanupTmp);

const T0 = 1_760_000_000_000;

async function setup(opts: { sink?: boolean } = {}) {
  const home = await repo();
  const service = createService(openStore(tmp()), { user: "adam" });
  const project = ProjectMeta.parse(
    service.handle({ method: "createProject", name: "Silo", key: "SILO", folder: null, color: "#336699" }),
  );
  const create = (title: string, parentId: string | null) =>
    Ticket.parse(
      service.handle({
        method: "command",
        projectId: project.id,
        command: { method: "createTicket", title, parentId },
      }),
    );
  const feature = create("Saisir hors ligne", null);
  const step = create("Formulaire", feature.id);
  const events: { projectId: string; event: ProjectEventInput }[] = [];
  const emitted: ChangeMessage[] = [];
  const clock = { now: T0 };
  const sessions = startTicketSessions({
    db: new Database(":memory:", { strict: true }),
    service,
    clock: { now: () => clock.now },
    ...(opts.sink !== false && { sink: { record: (projectId, event) => events.push({ projectId, event }) } }),
    emit: (message) => emitted.push(message),
  });
  const ticket = (id: string): TicketView => {
    const found = call(service, { method: "getProject", projectId: project.id }).tickets.find(
      (t) => t.id === id,
    );
    if (!found) throw new Error(`ticket ${id}`);
    return found;
  };
  const run = (req: {
    ticketKey: string | null;
    cwd?: string | null;
    state: "start" | "ping" | "stop";
    tool?: string;
  }) =>
    sessions.rpc.handle(
      { method: "setTicketSession", projectId: project.id, cwd: null, ...req },
      LOCAL_CONTEXT,
    );
  const command = (cmd: Parameters<typeof service.docs.run>[1]) => service.docs.run(project.id, cmd);
  return { home, service, project, feature, step, events, emitted, clock, sessions, ticket, run, command };
}

test("a remote session may not declare a ticket session", async () => {
  const { project, sessions } = await setup();
  const req = { method: "setTicketSession", projectId: project.id, ticketKey: "SILO-2", cwd: null } as const;
  await expect(
    sessions.rpc.handle({ ...req, state: "start" }, { sessionHash: "h", remote: true }),
  ).rejects.toThrow(new KiboError("FORBIDDEN", "this action is only allowed from this machine"));
});

test("start opens the session, journals it and leaves the status alone", async () => {
  const { project, feature, step, events, emitted, sessions, ticket, run } = await setup();
  const before = ticket(step.id).statusId;
  expect(await run({ ticketKey: "SILO-2", state: "start" })).toEqual({ tool: "T3 Code", startedAt: T0 });
  expect(sessions.activity(project.id)).toEqual(new Map([[step.id, { tool: "T3 Code", startedAt: T0 }]]));
  expect(events).toEqual([
    {
      projectId: project.id,
      event: {
        kind: "session_started",
        ticketId: step.id,
        featureId: feature.id,
        source: "full-delivery",
        data: { ticketKey: "SILO-2", tool: "T3 Code" },
      },
    },
  ]);
  expect(emitted).toEqual([{ projectId: project.id }]);
  expect(ticket(step.id).statusId).toBe(before);
});

test("ping extends the session, start again only pings, the tool is kept", async () => {
  const { project, step, events, clock, sessions, run } = await setup();
  await run({ ticketKey: "SILO-2", state: "start", tool: "Cursor" });
  clock.now = T0 + 90 * 60_000;
  expect(await run({ ticketKey: "SILO-2", state: "ping" })).toEqual({ tool: "Cursor", startedAt: T0 });
  clock.now = T0 + 3 * 3_600_000;
  expect(await run({ ticketKey: "SILO-2", state: "start" })).toEqual({ tool: "Cursor", startedAt: T0 });
  expect(sessions.activity(project.id).get(step.id)).toEqual({ tool: "Cursor", startedAt: T0 });
  expect(events.map((e) => e.event.kind)).toEqual(["session_started"]);
});

test("ping without an open session does nothing", async () => {
  const { events, emitted, run } = await setup();
  expect(await run({ ticketKey: "SILO-2", state: "ping" })).toBeNull();
  expect(events).toEqual([]);
  expect(emitted).toEqual([]);
});

test("stop closes the session and journals its duration", async () => {
  const { project, step, events, emitted, clock, sessions, run } = await setup();
  await run({ ticketKey: "SILO-2", state: "start" });
  clock.now = T0 + 42 * 60_000;
  expect(await run({ ticketKey: "SILO-2", state: "stop" })).toBeNull();
  expect(sessions.activity(project.id).size).toBe(0);
  expect(events.at(-1)?.event).toMatchObject({
    kind: "session_stopped",
    ticketId: step.id,
    data: { ticketKey: "SILO-2", tool: "T3 Code", durationMs: 42 * 60_000, ended: "stop" },
  });
  expect(emitted).toHaveLength(2);
  expect(await run({ ticketKey: "SILO-2", state: "stop" })).toBeNull();
  expect(events).toHaveLength(2);
});

test("a session silent for two hours is closed before the next call", async () => {
  const { events, clock, run } = await setup();
  await run({ ticketKey: "SILO-2", state: "start" });
  clock.now = T0 + SESSION_TIMEOUT_MS + 1;
  expect(await run({ ticketKey: "SILO-2", state: "start" })).toEqual({
    tool: "T3 Code",
    startedAt: clock.now,
  });
  expect(events.map((e) => [e.event.kind, e.event.data.ended ?? null])).toEqual([
    ["session_started", null],
    ["session_stopped", "timeout"],
    ["session_started", null],
  ]);
});

test("a session of an update is journaled as update-delivery", async () => {
  const { step, events, run, command } = await setup();
  const delivery = { step: 7, note: "", at: T0, runId: null, kind: "update" as const };
  command({ method: "setTicketDelivery", ticketId: step.id, delivery });
  await run({ ticketKey: "SILO-2", state: "start" });
  expect(events[0]?.event.source).toBe("update-delivery");
});

test("an unknown key or project is not found", async () => {
  const { sessions, run } = await setup();
  await expect(run({ ticketKey: "SILO-9", state: "start" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    sessions.rpc.handle(
      { method: "setTicketSession", projectId: "nope", ticketKey: "SILO-2", cwd: null, state: "start" },
      LOCAL_CONTEXT,
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("without a key, the ticket is the one that declares the current branch", async () => {
  const { home, step, run, command } = await setup();
  await git(["checkout", "-q", "-b", "feat/formulaire"], home);
  await expect(run({ ticketKey: null, cwd: home, state: "ping" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  command({
    method: "upsertExternalRef",
    ticketId: step.id,
    ref: { kind: "git_branch", branch: "feat/formulaire", base: null },
  });
  expect(await run({ ticketKey: null, cwd: home, state: "start" })).toEqual({
    tool: "T3 Code",
    startedAt: T0,
  });
});

test("without a key, a folder outside a repository or no folder at all is refused", async () => {
  const { run } = await setup();
  await expect(run({ ticketKey: null, cwd: tmp(), state: "ping" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(run({ ticketKey: null, cwd: null, state: "ping" })).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
});

test("without a sink, nothing is journaled and the session still opens", async () => {
  const { project, step, events, sessions, run } = await setup({ sink: false });
  await run({ ticketKey: "SILO-2", state: "start" });
  expect(events).toEqual([]);
  expect(sessions.activity(project.id).has(step.id)).toBe(true);
});

test("serves setTicketSession only", async () => {
  const { sessions } = await setup();
  expect(sessions.rpc.methods).toEqual(["setTicketSession"]);
  await expect(sessions.rpc.handle({ method: "listProjects" }, LOCAL_CONTEXT)).rejects.toMatchObject({
    code: "INTERNAL",
  });
});
