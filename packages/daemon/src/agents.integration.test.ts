import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AgentProfile,
  AgentsState,
  ChangeMessage,
  ProjectMeta,
  ProjectSnapshot,
  Question,
  RunLogEntry,
  RunView,
  Ticket,
  WorkspaceConfig,
} from "@kibo/schema";
import {
  FAKE_CLAUDE,
  type FakeScenarioName,
  releaseFakeRun,
  scenarioPath,
} from "./agents/fake-claude-scenario";
import { commit, git, cleanupTmp as removeRepos, repo } from "./agents/git-test-kit";
import { defaultHookLauncher } from "./agents/hook-launcher";
import { createOrchestrator, type Orchestrator } from "./agents/orchestrator";
import { openRunStore, type RunStore } from "./agents/run-store";
import { startServer } from "./server";
import { createService } from "./service";
import { openStore, type Store } from "./store";

const TOKEN = "c".repeat(64);
type Stack = {
  home: string;
  store: Store;
  runs: RunStore;
  orch: Orchestrator;
  server: ReturnType<typeof startServer>;
  messages: ChangeMessage[];
};
let stack: Stack | null = null;

function boot(scenario: FakeScenarioName): Stack {
  const home = mkdtempSync(join(tmpdir(), "kibo-int-"));
  mkdirSync(join(home, "fake"));
  const store = openStore(home);
  const runs = openRunStore(home);
  const service = createService(store, { user: "adam" });
  const messages: ChangeMessage[] = [];
  service.onChange((m) => messages.push(m));
  let orch: Orchestrator | null = null;
  const server = startServer({
    service,
    token: TOKEN,
    port: 0,
    uiDir: null,
    hooks: {
      verify: (runId, token) => orch?.hooks.verify(runId, token) ?? false,
      receive: (runId, payload, toolInput) => orch?.hooks.receive(runId, payload, toolInput) ?? null,
    },
  });
  orch = createOrchestrator({
    home,
    store: runs,
    data: service.agentData,
    claudeBin: FAKE_CLAUDE,
    hook: defaultHookLauncher(),
    demoAgent: { bin: FAKE_CLAUDE, env: () => ({}) },
    baseUrl: () => server.url,
    sampler: () => ({ cpu: 5, ram: 5 }),
    hostInfo: { cores: 8, ramGb: 16 },
    notify: () => {},
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath(scenario),
      KIBO_FAKE_CLAUDE_STATE: join(home, "fake"),
    },
    userHome: home,
    tickMs: 100,
  });
  service.attachAgents(orch);
  stack = { home, store, runs, orch, server, messages };
  return stack;
}

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

afterEach(removeRepos);
afterEach(async () => {
  if (!stack) return;
  const { orch } = stack;
  const pids = orch
    .state()
    .runs.flatMap((r) => orch.log(r.id))
    .flatMap((entry) => (entry.event.type === "spawned" ? [entry.event.pid] : []));
  stack.server.stop();
  await orch.stop();
  stack.runs.close();
  stack.store.close();
  rmSync(stack.home, { recursive: true, force: true });
  stack = null;
  expect(pids.length).toBeGreaterThan(0);
  expect(pids.filter(alive)).toEqual([]);
});

async function client(s: Stack) {
  const origin = s.server.url;
  const paired = await fetch(`${origin}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ token: TOKEN }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  return async <T>(body: unknown, status = 200): Promise<T> => {
    const res = await fetch(`${origin}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result?: T };
    expect({ status: res.status, body: json }).toMatchObject({ status });
    return json.result as T;
  };
}

async function until<T>(read: () => Promise<T>, ok: (value: T) => boolean, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (ok(value)) return value;
    if (Date.now() > end) throw new Error("condition not reached in time");
    await Bun.sleep(50);
  }
}

const profileInput = {
  name: "opus-dev",
  model: "opus",
  execution: "cli",
  permissionMode: "acceptEdits",
  workspace: "isolated",
  subagents: [],
};
const newProject = { method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" };

test("assign, question, answer, done: the ticket stays in progress until asked", async () => {
  const s = boot("question");
  const rpc = await client(s);
  const p = await rpc<ProjectMeta>(newProject);
  const t = await rpc<Ticket>({
    method: "command",
    projectId: p.id,
    command: { method: "createTicket", title: "Hooks", statusId: "in_progress" },
  });
  const profile = await rpc<AgentProfile>({
    method: "config",
    command: { method: "createProfile", profile: { ...profileInput, maxParallel: 2 } },
  });
  const run = await rpc<RunView>({
    method: "assignAgent",
    projectId: p.id,
    ticketId: t.id,
    profileId: profile.id,
    brief: "",
  });
  const agents = () => rpc<AgentsState>({ method: "getAgents" });
  const find = (state: AgentsState) => state.runs.find((r) => r.id === run.id);
  await until(agents, (a) => find(a)?.state === "waiting_input");
  await rpc({ method: "config", command: { method: "deleteProfile", profileId: profile.id } }, 409);
  await rpc({ method: "answerRun", runId: run.id, text: "Port dynamique" });
  await until(agents, (a) => find(a)?.state === "done");
  const snap = await rpc<ProjectSnapshot>({ method: "getProject", projectId: p.id });
  expect(snap.tickets.find((x) => x.id === t.id)).toMatchObject({
    statusId: "in_progress",
    assignee: { kind: "agent", ref: "opus-dev" },
  });
  expect((await agents()).resumable).toEqual([run.id]);
  await rpc({ method: "answerRun", runId: run.id, text: "Ajoute un test" });
  await until(agents, (a) => find(a)?.state === "done" && find(a)?.turns === 3);
  expect(s.messages).toContainEqual({ type: "run.changed", runId: run.id, state: "waiting_input" });
  expect(s.messages).toContainEqual({ type: "run.changed", runId: run.id, state: "done" });
  expect(s.messages).toContainEqual({ topic: "agents" });
  expect(s.messages).toContainEqual({ topic: "config" });
  const unauth = await fetch(`${s.server.url}/hooks/${run.id}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${"0".repeat(64)}` },
    body: "{}",
  });
  expect(unauth.status).toBe(401);
  await rpc({ method: "config", command: { method: "deleteProfile", profileId: profile.id } });
  const config = await rpc<WorkspaceConfig>({ method: "getConfig" });
  expect(config.profiles).toEqual([]);
}, 40_000);

test("four runs on three slots leave one queued", async () => {
  const s = boot("hold");
  const rpc = await client(s);
  const p = await rpc<ProjectMeta>(newProject);
  const profile = await rpc<AgentProfile>({
    method: "config",
    command: { method: "createProfile", profile: { ...profileInput, maxParallel: 4 } },
  });
  const runs: RunView[] = [];
  for (const title of ["A", "B", "C", "D"]) {
    const t = await rpc<Ticket>({
      method: "command",
      projectId: p.id,
      command: { method: "createTicket", title },
    });
    runs.push(
      await rpc<RunView>({
        method: "assignAgent",
        projectId: p.id,
        ticketId: t.id,
        profileId: profile.id,
        brief: "",
      }),
    );
  }
  const state = await rpc<AgentsState>({ method: "getAgents" });
  expect(state.host.used).toBe(3);
  expect(state.queue).toHaveLength(1);
  expect(state.queue[0]?.reason).toEqual({ kind: "host", used: 3, total: 3 });
  for (const r of runs) releaseFakeRun(join(s.home, "fake"), r.sessionId);
  await until(
    () => rpc<AgentsState>({ method: "getAgents" }),
    (a) => a.runs.every((r) => r.state === "done"),
  );
  const snap = await rpc<ProjectSnapshot>({ method: "getProject", projectId: p.id });
  expect(snap.tickets.map((x) => x.statusId)).toEqual([
    "in_progress",
    "in_progress",
    "in_progress",
    "in_progress",
  ]);
}, 40_000);

test("a second run resumes the main session with the branch commits and the answers in its brief", async () => {
  const s = boot("done");
  const rpc = await client(s);
  const folder = await repo();
  const p = await rpc<ProjectMeta>({ ...newProject, folder });
  const t = await rpc<Ticket>({
    method: "command",
    projectId: p.id,
    command: { method: "createTicket", title: "Hooks" },
  });
  const human = { kind: "human", ref: "adam" };
  const q = await rpc<Question>({
    method: "command",
    projectId: p.id,
    command: { method: "createQuestion", ticketId: t.id, title: "Port fixe ?", createdBy: human },
  });
  await rpc({
    method: "command",
    projectId: p.id,
    command: {
      method: "answerQuestion",
      questionId: q.id,
      answer: { kind: "text", text: "Non, dynamique" },
      by: human,
    },
  });
  const profile = await rpc<AgentProfile>({
    method: "config",
    command: { method: "createProfile", profile: { ...profileInput, workspace: "worktree", maxParallel: 1 } },
  });
  const agents = () => rpc<AgentsState>({ method: "getAgents" });
  const assign = (fresh: boolean) =>
    rpc<RunView>({
      method: "assignAgent",
      projectId: p.id,
      ticketId: t.id,
      profileId: profile.id,
      brief: "",
      fresh,
    });
  const finished = async (id: string): Promise<RunView> => {
    const state = await until(agents, (a) => a.runs.some((r) => r.id === id && r.state === "done"));
    const found = state.runs.find((r) => r.id === id);
    if (!found) throw new Error(`run ${id} missing`);
    return found;
  };
  const brief = (id: string) => readFileSync(join(s.home, "runs", id, "brief.md"), "utf8");
  const session = async (id: string) =>
    (await rpc<RunLogEntry[]>({ method: "getRunLog", runId: id })).find((e) => e.event.type === "session")
      ?.event;

  const first = await finished((await assign(false)).id);
  expect(brief(first.id)).toContain("Non, dynamique");
  const snap = await rpc<ProjectSnapshot>({ method: "getProject", projectId: p.id });
  expect(snap.questions[0]?.answer).toMatchObject({ deliveredRunId: first.id });

  const cwd = first.cwd ?? "";
  writeFileSync(join(cwd, "hooks.ts"), "export {};\n");
  await git(["add", "hooks.ts"], cwd);
  await git([...commit, "-m", "feat: récepteur de hooks"], cwd);
  const hash = await git(["rev-parse", "--short", "HEAD"], cwd);

  const second = await assign(false);
  expect(second.sessionId).toBe(first.sessionId);
  await finished(second.id);
  expect(await session(second.id)).toEqual({ type: "session", mode: "resumed", from: first.id });
  const text = brief(second.id);
  expect(text).toContain("## Commits de la branche");
  expect(text).toContain(`- ${hash} feat: récepteur de hooks`);
  expect(text).toContain("## Questions");

  const reset = await assign(true);
  expect(reset.sessionId).not.toBe(first.sessionId);
  await finished(reset.id);
  expect(await session(reset.id)).toEqual({ type: "session", mode: "fresh", reason: "user_reset" });
}, 60_000);
