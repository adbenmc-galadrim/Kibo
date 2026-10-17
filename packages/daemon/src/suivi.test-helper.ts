import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type {
  AgentsState,
  ProjectAgentView,
  ProjectCommand,
  ProjectEvent,
  ProjectSnapshot,
  RpcRequest,
  TicketSession,
} from "@kibo/schema";
import { z } from "zod";
import { testAgent, testAgentSource } from "./agents/agents-port.test-helper";
import { FAKE_CLAUDE, type FakeCall, fakeCalls, scenarioPath } from "./agents/fake-claude-scenario";
import type { Env } from "./code/run";
import { createGitFixture, type GitFixture, installFakeGh } from "./code/testing/git-fixture";
import { fakeBuild, okReport } from "./components/service.test-helper";
import { type Daemon, startDaemon } from "./daemon";

export const FIXED_NOW = "2026-10-16T14:52:00+02:00";

const Answer = z.object({ ok: z.boolean(), result: z.unknown() });
const Created = z.object({ id: z.string() });

export type FakePr = {
  number: number;
  url: string;
  state: "OPEN" | "MERGED";
  isDraft: boolean;
  head: string;
  base: string;
  reviewDecision: string;
  statusCheckRollup: Record<string, string>[];
};

export type Suivi = {
  repo: GitFixture;
  gh: Env;
  start(prPollMs: number): Promise<Client>;
  prs(list: FakePr[]): void;
  calls(): FakeCall[];
};

export type Client = {
  rpc<T>(req: RpcRequest): Promise<T>;
  stop(): Promise<void>;
};

const cleanups: (() => Promise<void> | void)[] = [];

export async function cleanSuivi(): Promise<void> {
  for (const clean of cleanups.splice(0).reverse()) await clean();
}

async function pair(daemon: Daemon): Promise<Client["rpc"]> {
  const headers = { "content-type": "application/json", origin: daemon.url };
  const paired = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers,
    body: JSON.stringify({ token: daemon.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  return async <T>(req: RpcRequest): Promise<T> => {
    const res = await fetch(`${daemon.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify(req),
    });
    const answer = Answer.parse(await res.json());
    if (!answer.ok) throw new Error(`rpc ${req.method} failed: ${JSON.stringify(answer)}`);
    return answer.result as T;
  };
}

async function boot(home: string, env: Env, prPollMs: number): Promise<Daemon> {
  const previous = process.env.KIBO_FIXED_NOW;
  process.env.KIBO_FIXED_NOW = FIXED_NOW;
  const fake = join(home, "fake");
  return startDaemon({
    agentSource: testAgentSource([testAgent({ id: "livraison", name: "livraison" })]).source,
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    build: fakeBuild,
    validate: okReport,
    claudeBin: FAKE_CLAUDE,
    sampler: () => ({ cpu: 5, ram: 5 }),
    transcriptRoot: fake,
    agentEnv: {
      ...process.env,
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("project-agent-routes"),
      KIBO_FAKE_CLAUDE_STATE: fake,
    },
    code: { env, prPollMs },
  }).finally(() => {
    if (previous === undefined) delete process.env.KIBO_FIXED_NOW;
    else process.env.KIBO_FIXED_NOW = previous;
  });
}

export function createSuivi(): Suivi {
  const home = mkdtempSync(join(tmpdir(), "kibo-suivi-"));
  mkdirSync(join(home, "fake"));
  const repo = createGitFixture({ remote: false });
  repo.commit("chore: init", { "README.md": "# kibo\n" });
  const gh = installFakeGh(repo.dir);
  cleanups.push(() => rmSync(home, { recursive: true, force: true }), repo.cleanup);
  return {
    repo,
    gh,
    async start(prPollMs) {
      const daemon = await boot(home, { ...repo.env, ...gh }, prPollMs);
      let stopped = false;
      const stop = async () => {
        if (stopped) return;
        stopped = true;
        await daemon.stop();
      };
      cleanups.push(stop);
      return { rpc: await pair(daemon), stop };
    },
    prs: (list) => writeFileSync(gh.FAKE_GH_STATE ?? "", JSON.stringify(list)),
    calls: () => {
      const fake = join(home, "fake");
      return [...new Bun.Glob("*.calls.jsonl").scanSync(fake)].flatMap((file) =>
        fakeCalls(fake, file.replace(".calls.jsonl", "")),
      );
    },
  };
}

export async function until<T>(read: () => Promise<T | undefined>, what: string, ms = 30_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error(`${what} not reached in time`);
    await Bun.sleep(50);
  }
}

export function projectOf(client: Client, projectId: string) {
  const command = <T>(cmd: ProjectCommand) => client.rpc<T>({ method: "command", projectId, command: cmd });
  const create = async (cmd: ProjectCommand) => Created.parse(await command(cmd)).id;
  const snapshot = () => client.rpc<ProjectSnapshot>({ method: "getProject", projectId });
  const ticket = async (key: string) => {
    const found = (await snapshot()).tickets.find((t) => t.key === key);
    if (!found) throw new Error(`no ticket ${key}`);
    return found;
  };
  const events = async (input: { limit?: number; before?: number } = {}) =>
    client.rpc<{ items: ProjectEvent[]; nextBefore: number | null }>({
      method: "listProjectEvents",
      projectId,
      limit: input.limit ?? 200,
      ...(input.before !== undefined && { before: input.before }),
    });
  const kinds = async () => (await events()).items.map((e) => e.kind).reverse();
  const session = (ticketKey: string, state: "start" | "stop") =>
    client.rpc<TicketSession | null>({
      method: "setTicketSession",
      projectId,
      ticketKey,
      cwd: null,
      state,
    });
  const agent = () => client.rpc<ProjectAgentView>({ method: "getProjectAgent", projectId });
  const runs = async () =>
    (await client.rpc<AgentsState>({ method: "getAgents" })).runs.filter((r) => r.projectId === projectId);
  return { command, create, snapshot, ticket, events, kinds, session, agent, runs };
}

export async function createKibo(client: Client, folder: string): Promise<string> {
  const created = await client.rpc({
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder,
    color: "#F97316",
  });
  return Created.parse(created).id;
}
