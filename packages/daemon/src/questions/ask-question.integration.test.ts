import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type {
  AgentProfile,
  AgentsState,
  DeliveryResult,
  ProjectMeta,
  ProjectSnapshot,
  RunView,
  Ticket,
} from "@kibo/schema";
import { FAKE_CLAUDE } from "../agents/fake-claude-scenario";
import type { Notice } from "../agents/notifier";
import { type Daemon, startDaemon } from "../daemon";

const SCENARIO = join(import.meta.dir, "../agents/scenarios/ask-question.json");
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function client(d: Daemon) {
  const headers = { "content-type": "application/json", origin: d.url };
  const paired = await fetch(`${d.url}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: d.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  return async <T>(body: unknown): Promise<T> => {
    const res = await fetch(`${d.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result: T };
    if (!json.ok) throw new Error(`rpc ${JSON.stringify(body)} failed: ${JSON.stringify(json)}`);
    return json.result;
  };
}

async function waitFor<T>(read: () => Promise<T | undefined>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error("condition not reached in time");
    await Bun.sleep(50);
  }
}

async function start(notices: Notice[]) {
  const home = mkdtempSync(join(tmpdir(), "kibo-ask-question-"));
  mkdirSync(join(home, "fake"));
  const d = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    claudeBin: FAKE_CLAUDE,
    sampler: () => ({ cpu: 5, ram: 5 }),
    notify: (notice) => notices.push(notice),
    agentEnv: {
      ...process.env,
      KIBO_FAKE_CLAUDE_SCENARIO: SCENARIO,
      KIBO_FAKE_CLAUDE_STATE: join(home, "fake"),
    },
  });
  cleanups.push(async () => {
    await d.stop();
    rmSync(home, { recursive: true, force: true });
  });
  return client(d);
}

test("a run asks a question to validate, ends done, and gets the answer only when delivered", async () => {
  const notices: Notice[] = [];
  const rpc = await start(notices);
  const project = await rpc<ProjectMeta>({
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#F97316",
  });
  const ticket = await rpc<Ticket>({
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title: "Stockage", statusId: "in_progress" },
  });
  const profile = await rpc<AgentProfile>({
    method: "config",
    command: {
      method: "createProfile",
      profile: {
        name: "emis-livraison",
        model: "opus",
        execution: "cli",
        permissionMode: "acceptEdits",
        workspace: "isolated",
        subagents: [],
        maxParallel: 1,
      },
    },
  });
  const run = await rpc<RunView>({
    method: "assignAgent",
    projectId: project.id,
    ticketId: ticket.id,
    profileId: profile.id,
    brief: "ask_question",
  });
  const runOf = async () =>
    (await rpc<AgentsState>({ method: "getAgents" })).runs.find((r) => r.id === run.id);
  await waitFor(async () => ((await runOf())?.state === "done" ? true : undefined));
  const snapshot = () => rpc<ProjectSnapshot>({ method: "getProject", projectId: project.id });
  const [question] = (await snapshot()).questions;
  expect(question).toMatchObject({
    ticketId: ticket.id,
    runId: run.id,
    title: "Bloquer le dépôt sur une affaire archivée ?",
    provisional: "Non",
    blocking: false,
    createdBy: { kind: "agent", ref: "emis-livraison" },
  });
  expect((await snapshot()).tickets.find((t) => t.id === ticket.id)?.statusId).toBe("in_progress");
  expect((await rpc<AgentsState>({ method: "getAgents" })).questions).toEqual([
    { runId: run.id, open: 1, undelivered: 0, latestTitle: "Bloquer le dépôt sur une affaire archivée ?" },
  ]);
  expect(notices).toContainEqual({
    title: "emis-livraison-1 a posé une question",
    body: "EMIS-1 · Bloquer le dépôt sur une affaire archivée ?",
  });

  await rpc({
    method: "command",
    projectId: project.id,
    command: {
      method: "answerQuestion",
      questionId: question?.id,
      answer: { kind: "confirm" },
      by: { kind: "human", ref: "x" },
    },
  });
  expect((await runOf())?.state).toBe("done");
  expect((await runOf())?.turns).toBe(1);
  expect((await rpc<AgentsState>({ method: "getAgents" })).questions).toEqual([
    { runId: run.id, open: 0, undelivered: 1, latestTitle: null },
  ]);

  expect(
    await rpc<DeliveryResult>({ method: "deliverAnswers", projectId: project.id, ticketId: ticket.id }),
  ).toEqual({
    sent: 1,
    runId: run.id,
  });
  await waitFor(async () => {
    const current = await runOf();
    return current?.state === "done" && current.turns === 2 ? current : undefined;
  });
  expect((await snapshot()).questions[0]?.answer).toMatchObject({
    kind: "confirm",
    by: { kind: "human", ref: "adam" },
    deliveredRunId: run.id,
  });
  expect((await rpc<AgentsState>({ method: "getAgents" })).questions).toEqual([]);
}, 60_000);
