import { Database } from "bun:sqlite";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type {
  Agent,
  AgentRef,
  AgentSummary,
  AgentsState,
  ProjectMeta,
  RunMomentsPage,
  RunView,
  Ticket,
} from "@kibo/schema";
import { z } from "zod";
import { FAKE_CLAUDE, scenarioPath } from "./agents/fake-claude-scenario";
import { cleanupTmp, repo } from "./agents/git-test-kit";
import { type Daemon, startDaemon } from "./daemon";
import { SESSION_COOKIE } from "./sessions/cookie";
import { openSessionStore } from "./sessions/session-store";

const cleanups: (() => Promise<void>)[] = [];

export async function stopKits(): Promise<void> {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  cleanupTmp();
}

const Reply = z.object({ ok: z.boolean(), result: z.unknown(), error: z.unknown().optional() });

export type Rpc = <T>(body: Record<string, unknown>) => Promise<T>;
export type Raw = (body: Record<string, unknown>) => Promise<z.infer<typeof Reply>>;
export type Kit = {
  home: string;
  claude: string;
  daemon: Daemon;
  rpc: Rpc;
  raw: Raw;
  events: unknown[];
  restart(): Promise<void>;
};

export const agentMd = (name: string, description: string, body = `Tu es ${name}.`) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;
export const skillMd = (name: string, description: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;

export function put(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

async function pairCookie(d: Daemon): Promise<string> {
  const paired = await fetch(`${d.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: d.url },
    body: JSON.stringify({ token: d.token }),
  });
  return paired.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function listen(d: Daemon, cookie: string, events: unknown[]): Promise<() => void> {
  const ws = new WebSocket(`${d.url.replace("http", "ws")}/api/events`, {
    headers: { origin: d.url, cookie },
  });
  ws.onmessage = (e) => events.push(JSON.parse(String(e.data)));
  await new Promise((resolve) => {
    ws.onopen = resolve;
  });
  return () => ws.close();
}

function client(d: Daemon, cookie: string) {
  const headers = { "content-type": "application/json", origin: d.url };
  const raw = async (body: Record<string, unknown>) => {
    const res = await fetch(`${d.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(body),
    });
    return Reply.parse(await res.json());
  };
  const rpc: Rpc = async <T>(body: Record<string, unknown>): Promise<T> => {
    const reply = await raw(body);
    if (!reply.ok) throw new Error(`rpc ${JSON.stringify(body)} failed: ${JSON.stringify(reply)}`);
    return reply.result as T;
  };
  return { rpc, raw };
}

export function remoteClient(kit: Kit): { rpc: Rpc; raw: Raw } {
  const db = new Database(join(kit.home, "kibo.db"), { strict: true });
  const { id } = openSessionStore(db).create({ deviceName: "téléphone", remote: true }, Date.now());
  db.close();
  return client(kit.daemon, `${SESSION_COOKIE}=${id}`);
}

const boot = (home: string, claude: string, scenario: string, env: Record<string, string> = {}) =>
  startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    claudeBin: FAKE_CLAUDE,
    ticketExecution: "allowed",
    sampler: () => ({ cpu: 5, ram: 5 }),
    userHome: home,
    transcriptRoot: join(home, "fake"),
    agentEnv: {
      ...process.env,
      CLAUDE_CONFIG_DIR: claude,
      KIBO_FAKE_CLAUDE_SCENARIO: scenario,
      KIBO_FAKE_CLAUDE_STATE: join(home, "fake", "projects"),
      ...env,
    },
  });

export type KitOptions = {
  fixture?: string;
  scenario?: string;
  prepare?(claude: string): () => void;
  env?(home: string): Record<string, string>;
};

export async function startKit(o: KitOptions = {}): Promise<Kit> {
  const root = mkdtempSync(join(tmpdir(), "kibo-agents-skills-"));
  const home = join(root, "kibo");
  if (o.fixture) cpSync(o.fixture, home, { recursive: true });
  mkdirSync(join(home, "fake", "projects"), { recursive: true });
  const claude = join(root, "claude");
  mkdirSync(claude, { recursive: true });
  const restore = o.prepare?.(claude) ?? (() => {});
  const scenario = o.scenario ?? scenarioPath("skills-routes");
  const env = o.env?.(home) ?? {};
  let daemon = await boot(home, claude, scenario, env).catch((e: unknown) => {
    restore();
    rmSync(root, { recursive: true, force: true });
    throw e;
  });
  const events: unknown[] = [];
  const connect = async () => {
    const cookie = await pairCookie(daemon);
    closeEvents = await listen(daemon, cookie, events);
    return client(daemon, cookie);
  };
  let closeEvents = () => {};
  const kit: Kit = { home, claude, daemon, events, ...(await connect()), restart: async () => {} };
  kit.restart = async () => {
    closeEvents();
    await daemon.stop();
    daemon = await boot(home, claude, scenario, env);
    Object.assign(kit, { daemon, ...(await connect()) });
  };
  cleanups.push(async () => {
    closeEvents();
    await daemon.stop();
    restore();
    rmSync(root, { recursive: true, force: true });
  });
  return kit;
}

export type Seeded = {
  project: ProjectMeta;
  folder: string;
  tickets: Map<string, Ticket>;
  ref(name: string): AgentRef;
};

const SUPERPOWERS = ["plugins", "cache", "official", "superpowers", "6.4.1"];

export function seedClaudeHome(claude: string): void {
  const plugin = join(claude, ...SUPERPOWERS);
  put(join(plugin, "skills", "brainstorming", "SKILL.md"), skillMd("brainstorming", "Brainstorm du plugin"));
  const index = {
    version: 2,
    plugins: { "superpowers@official": [{ scope: "user", installPath: plugin, version: "6.4.1" }] },
  };
  put(join(claude, "plugins", "installed_plugins.json"), JSON.stringify(index));
}

export async function seedProject(kit: Kit): Promise<Seeded> {
  const folder = await repo();
  const agents = join(folder, ".claude", "agents");
  put(join(agents, "kibo-dev.md"), agentMd("kibo-dev", "Implémente une tâche du plan en TDD"));
  put(join(agents, "livraison.md"), agentMd("livraison", "Livre un ticket avec des commits propres"));
  put(join(agents, "review.md"), agentMd("review", "Relit un diff et rend un verdict"));
  put(
    join(folder, ".claude", "skills", "brainstorming", "SKILL.md"),
    skillMd("brainstorming", "Explore une idée"),
  );
  seedClaudeHome(kit.claude);
  const project = await kit.rpc<ProjectMeta>({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder,
    color: "#F97316",
  });
  const tickets = new Map<string, Ticket>();
  for (let i = 1; i <= 16; i++) {
    const ticket = await kit.rpc<Ticket>({
      method: "command",
      projectId: project.id,
      command: { method: "createTicket", title: `Ticket ${i}`, statusId: "todo" },
    });
    tickets.set(`KIB-${i}`, ticket);
  }
  return { project, folder, tickets, ref: (name) => `project:${project.id}:${name}` };
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

export async function assignAndFinish(kit: Kit, s: Seeded, key: string, agent: AgentRef): Promise<RunView> {
  const ticket = s.tickets.get(key);
  if (!ticket) throw new Error(`no ticket ${key}`);
  const run = await kit.rpc<RunView>({
    method: "assignAgent",
    projectId: s.project.id,
    ticketId: ticket.id,
    profileId: agent,
    brief: "",
  });
  return waitFor(async () => {
    const found = (await kit.rpc<AgentsState>({ method: "getAgents" })).runs.find((r) => r.id === run.id);
    return found && ["done", "failed"].includes(found.state) ? found : undefined;
  });
}

export type AgentList = { agents: AgentSummary[] };

export async function readyKiboDev(kit: Kit, s: Seeded): Promise<void> {
  await kit.rpc<AgentList>({ method: "agents.list", projectId: s.project.id });
  await kit.rpc<Agent>({
    method: "agents.settings",
    ref: s.ref("kibo-dev"),
    patch: {
      subagents: [s.ref("review")],
      skills: { mode: "list", ids: ["brainstorming", "superpowers:brainstorming"] },
    },
  });
}

export async function momentsOf(kit: Kit, runId: string, done: (page: RunMomentsPage) => boolean) {
  return waitFor(async () => {
    const page = await kit.rpc<RunMomentsPage>({ method: "runMoments", runId });
    return done(page) ? page : undefined;
  });
}

export const labels = (page: RunMomentsPage) =>
  page.moments.flatMap((m) => (m.data.kind === "actions" ? m.data.actions.map((a) => a.label) : []));
export const actions = (page: RunMomentsPage) =>
  page.moments.flatMap((m) => (m.data.kind === "actions" ? m.data.actions : []));
export const reminders = (page: RunMomentsPage) =>
  page.moments.flatMap((m) => (m.data.kind === "reminder" ? [m.data.reminder] : []));
