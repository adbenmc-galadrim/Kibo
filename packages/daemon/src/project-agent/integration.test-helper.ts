import { afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type {
  AgentProfile,
  AgentsState,
  Batch,
  ProjectAgentView,
  ProjectMeta,
  ProjectSnapshot,
  RunLogEntry,
  RunView,
  Ticket,
} from "@kibo/schema";
import { z } from "zod";
import { FAKE_CLAUDE, type FakeCall, fakeCalls, scenarioPath } from "../agents/fake-claude-scenario";
import type { Notice } from "../agents/notifier";
import { type Daemon, startDaemon } from "../daemon";

export type Rpc = <T>(body: Record<string, unknown>) => Promise<T>;

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function client(d: Daemon): Promise<Rpc> {
  const headers = { "content-type": "application/json", origin: d.url };
  const paired = await fetch(`${d.url}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: d.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  return async <T>(body: Record<string, unknown>): Promise<T> => {
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

export async function waitFor<T>(read: () => Promise<T | undefined>, ms = 30_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error("condition not reached in time");
    await Bun.sleep(50);
  }
}

export type Stack = {
  home: string;
  url: string;
  rpc: Rpc;
  notices: Notice[];
  calls(sessionId: string): FakeCall[];
  restart(): Promise<void>;
};

async function boot(home: string, notices: Notice[]): Promise<Daemon> {
  return startDaemon({
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
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("project-agent-routes"),
      KIBO_FAKE_CLAUDE_STATE: join(home, "fake"),
    },
  });
}

export async function startStack(): Promise<Stack> {
  const home = mkdtempSync(join(tmpdir(), "kibo-project-agent-it-"));
  mkdirSync(join(home, "fake"));
  const notices: Notice[] = [];
  let daemon: Daemon | null = await boot(home, notices);
  const stack: Stack = {
    home,
    url: daemon.url,
    rpc: await client(daemon),
    notices,
    calls: (sessionId) => fakeCalls(join(home, "fake"), sessionId),
    async restart() {
      await daemon?.stop();
      daemon = await boot(home, notices);
      stack.url = daemon.url;
      stack.rpc = await client(daemon);
    },
  };
  cleanups.push(async () => {
    await daemon?.stop();
    daemon = null;
    rmSync(home, { recursive: true, force: true });
  });
  return stack;
}

export type Seeded = { project: ProjectMeta; receiver: Ticket; docs: Ticket; opus: AgentProfile };

export async function seedKibo(rpc: Rpc): Promise<Seeded> {
  const project = await rpc<ProjectMeta>({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: null,
    color: "#F97316",
  });
  const ticket = (title: string, description: string) =>
    rpc<Ticket>({
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title, description, statusId: "todo" },
    });
  const receiver = await ticket("Récepteur de hooks", "Recevoir les hooks de Claude Code.");
  const docs = await ticket("Documentation", "Écrire le guide.");
  const opus = await rpc<AgentProfile>({
    method: "config",
    command: {
      method: "createProfile",
      profile: {
        name: "opus",
        model: "opus",
        execution: "cli",
        permissionMode: "acceptEdits",
        workspace: "isolated",
        subagents: [],
        maxParallel: 1,
      },
    },
  });
  return { project, receiver, docs, opus };
}

export const agentsOf = (rpc: Rpc) => rpc<AgentsState>({ method: "getAgents" });

export const viewOf = (rpc: Rpc, projectId: string, runId?: string) =>
  rpc<ProjectAgentView>({ method: "getProjectAgent", projectId, ...(runId && { runId }) });

export const snapshotOf = (rpc: Rpc, projectId: string) =>
  rpc<ProjectSnapshot>({ method: "getProject", projectId });

export const logOf = (rpc: Rpc, runId: string) => rpc<RunLogEntry[]>({ method: "getRunLog", runId });

export function turnDone(rpc: Rpc, runId: string, turns: number): Promise<RunView> {
  return waitFor(async () => {
    const run = (await agentsOf(rpc)).runs.find((r) => r.id === runId);
    return run && run.turns === turns && (run.state === "done" || run.state === "failed") ? run : undefined;
  });
}

export async function send(rpc: Rpc, projectId: string, text: string): Promise<RunView> {
  return rpc<RunView>({ method: "sendProjectAgentMessage", projectId, text });
}

export async function decide(rpc: Rpc, input: Record<string, unknown>): Promise<Batch> {
  return rpc<Batch>({ method: "decideBatch", ...input });
}

const McpConfig = z.object({
  mcpServers: z.object({ kibo: z.object({ env: z.object({ KIBO_RUN_TOKEN: z.string() }) }) }),
});

export function runToken(home: string, runId: string): string {
  const config = McpConfig.parse(JSON.parse(readFileSync(join(home, "runs", runId, "mcp.json"), "utf8")));
  return config.mcpServers.kibo.env.KIBO_RUN_TOKEN;
}

export const postMcp = (url: string, runId: string, token: string | null) =>
  fetch(`${url}/agent-mcp/${runId}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ tool: "project_overview", input: {} }),
  });
