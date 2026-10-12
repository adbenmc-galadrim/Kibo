import { afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { Agent, AgentsState, ProjectMeta, RunView, Ticket, WorkspaceStrategy } from "@kibo/schema";
import { type TestAgentSource, testAgent, testAgentSource } from "../agents/agents-port.test-helper";
import { FAKE_CLAUDE } from "../agents/fake-claude-scenario";
import { type Daemon, startDaemon } from "../daemon";

const cleanups: (() => Promise<void>)[] = [];

export const cleanDaemons = () =>
  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) await cleanup();
  });

export type Client = {
  daemon: Daemon;
  home: string;
  rpc<T>(body: unknown): Promise<T>;
  events: unknown[];
  agents: TestAgentSource;
};

async function connect(daemon: Daemon, home: string, agents: TestAgentSource): Promise<Client> {
  const headers = { "content-type": "application/json", origin: daemon.url };
  const paired = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: daemon.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  const events: unknown[] = [];
  const ws = new WebSocket(`${daemon.url.replace("http", "ws")}/api/events`, {
    headers: { origin: daemon.url, cookie },
  });
  ws.onmessage = (e) => events.push(JSON.parse(String(e.data)));
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  cleanups.push(async () => ws.close());
  const rpc = async <T>(body: unknown): Promise<T> => {
    const res = await fetch(`${daemon.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result: T };
    if (!json.ok) throw new Error(`rpc ${JSON.stringify(body)} failed: ${JSON.stringify(json)}`);
    return json.result;
  };
  return { daemon, home, rpc, events, agents };
}

export async function waitFor<T>(read: () => Promise<T | undefined>, ms = 20_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error("condition not reached in time");
    await Bun.sleep(50);
  }
}

export type TestDaemonOptions = {
  scenario: string | ((home: string) => string);
  transcriptRoot?: (home: string) => string;
};

export async function startTestDaemon(o: TestDaemonOptions): Promise<Client> {
  const home = mkdtempSync(join(tmpdir(), "kibo-visibility-"));
  mkdirSync(join(home, "fake", "projects"), { recursive: true });
  const agents = testAgentSource();
  const daemon = await startDaemon({
    agentSource: agents.source,
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    claudeBin: FAKE_CLAUDE,
    sampler: () => ({ cpu: 5, ram: 5 }),
    transcriptRoot: (o.transcriptRoot ?? ((h) => join(h, "fake")))(home),
    agentEnv: {
      ...process.env,
      KIBO_FAKE_CLAUDE_SCENARIO: typeof o.scenario === "string" ? o.scenario : o.scenario(home),
      KIBO_FAKE_CLAUDE_STATE: join(home, "fake", "projects"),
    },
  });
  cleanups.push(async () => {
    await daemon.stop();
    rmSync(home, { recursive: true, force: true });
  });
  return connect(daemon, home, agents);
}

export type Seeded = { project: ProjectMeta; ticket: Ticket; profile: Agent };

export async function seed(
  { rpc, agents }: Client,
  o: { folder?: string | null; workspace?: WorkspaceStrategy; title?: string } = {},
): Promise<Seeded> {
  const project = await rpc<ProjectMeta>({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: o.folder ?? null,
    color: "#F97316",
  });
  const ticket = await rpc<Ticket>({
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title: o.title ?? "Fil", statusId: "todo" },
  });
  const profile = agents.add(
    testAgent({ id: "opus-dev", name: "opus-dev", workspace: o.workspace ?? "isolated", maxParallel: 1 }),
  );
  return { project, ticket, profile };
}

export async function assign({ rpc }: Client, s: Seeded): Promise<RunView> {
  return rpc<RunView>({
    method: "assignAgent",
    projectId: s.project.id,
    ticketId: s.ticket.id,
    profileId: s.profile.ref,
    brief: "",
  });
}

export async function runIn({ rpc }: Client, runId: string, states: readonly string[]): Promise<RunView> {
  return waitFor(async () => {
    const found = (await rpc<AgentsState>({ method: "getAgents" })).runs.find((r) => r.id === runId);
    return found && states.includes(found.state) ? found : undefined;
  });
}
