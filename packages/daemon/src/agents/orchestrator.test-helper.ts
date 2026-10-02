import { afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentProfile,
  DEFAULT_WORKFLOW,
  type Guideline,
  type HostLoad,
  KiboError,
  type ProjectSnapshot,
  type RunView,
  type TicketView,
} from "@kibo/schema";
import { FAKE_CLAUDE, type FakeScenarioName, scenarioPath } from "./fake-claude-scenario";
import { defaultHookLauncher } from "./hook-launcher";
import { type HookSink, handleHook } from "./hook-route";
import type { Notice } from "./notifier";
import {
  type AgentDataPort,
  createOrchestrator,
  type Orchestrator,
  type OrchestratorOptions,
} from "./orchestrator";
import { openRunStore, type RunStore } from "./run-store";
import { newRunToken } from "./run-token";

const ticket = (id: string, key: string | null): TicketView => ({
  id,
  key,
  pendingSeq: key === null ? 1 : null,
  keyLabel: key ?? "KIB-…",
  title: `Ticket ${key ?? id}`,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
});

const project: ProjectSnapshot = {
  meta: { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#F97316" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [...[1, 2, 3, 4].map((n) => ticket(`t${n}`, `KIB-${n}`)), ticket("pending", null)],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-5",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

export const profile = (p: Partial<AgentProfile> = {}): AgentProfile => ({
  id: "opus",
  name: "opus-dev",
  model: "opus",
  execution: "cli",
  permissionMode: "acceptEdits",
  workspace: "isolated",
  maxParallel: 4,
  subagents: [],
  enabled: true,
  system: false,
  ...p,
});

export type Harness = {
  orch: Orchestrator;
  options: OrchestratorOptions;
  store: RunStore;
  home: string;
  state: string;
  url: string;
  assigned: string[];
  started: string[];
  done: string[];
  notices: Notice[];
  tokens: Map<string, string>;
  stopServer: () => void;
};

type Setup = {
  scenario: FakeScenarioName;
  profiles?: AgentProfile[];
  load?: () => HostLoad;
  claudeBin?: string | null;
  env?: Record<string, string>;
  guidelines?: Guideline[];
};

let current: Harness | null = null;

export function setup(o: Setup): Harness {
  const home = mkdtempSync(join(tmpdir(), "kibo-orch-"));
  const state = join(home, "fake");
  mkdirSync(state);
  const store = openRunStore(home);
  const assigned: string[] = [];
  const started: string[] = [];
  const done: string[] = [];
  const notices: Notice[] = [];
  const tokens = new Map<string, string>();
  const profiles = o.profiles ?? [profile()];
  const data: AgentDataPort = {
    profiles: () => profiles,
    ticketContext: (projectId, ticketId) => {
      const t = project.tickets.find((x) => x.id === ticketId);
      if (projectId !== "p1" || !t) throw new KiboError("NOT_FOUND", `ticket ${ticketId} not found`);
      return { project, ticket: t, domain: null };
    },
    guidelines: () => o.guidelines ?? [],
    assignTicket: (_projectId, ticketId, name) => {
      assigned.push(`${ticketId}:${name}`);
    },
    runStarted: (_projectId, ticketId) => {
      started.push(ticketId);
    },
    runDone: (_projectId, ticketId) => {
      done.push(ticketId);
    },
  };
  let orch: Orchestrator | null = null;
  const sink: HookSink = {
    verify: (runId, token) => orch?.hooks.verify(runId, token) ?? false,
    receive: (runId, payload, toolInput) => orch?.hooks.receive(runId, payload, toolInput) ?? null,
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      const runId = /^\/hooks\/([^/]+)$/.exec(new URL(req.url).pathname)?.[1];
      return runId ? handleHook(req, runId, sink) : new Response("not found", { status: 404 });
    },
  });
  const url = `http://127.0.0.1:${server.port}`;
  const options: OrchestratorOptions = {
    home,
    store,
    data,
    claudeBin: o.claudeBin === undefined ? FAKE_CLAUDE : o.claudeBin,
    hook: defaultHookLauncher(),
    baseUrl: () => url,
    sampler: o.load ?? (() => ({ cpu: 10, ram: 20 })),
    hostInfo: { cores: 8, ramGb: 16 },
    notify: (n) => notices.push(n),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath(o.scenario),
      KIBO_FAKE_CLAUDE_STATE: state,
      ...o.env,
    },
    userHome: home,
    tickMs: 100,
    newToken: (runId) => {
      const minted = newRunToken();
      tokens.set(runId, minted.token);
      return minted;
    },
  };
  orch = createOrchestrator(options);
  current = {
    orch,
    options,
    store,
    home,
    state,
    url,
    assigned,
    started,
    done,
    notices,
    tokens,
    stopServer: () => server.stop(true),
  };
  return current;
}

export const cleanHarness = () =>
  afterEach(async () => {
    if (!current) return;
    await current.orch.stop();
    current.stopServer();
    current.store.close();
    rmSync(current.home, { recursive: true, force: true });
    current = null;
  });

export async function waitUntil(check: () => boolean, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("condition not reached in time");
    await Bun.sleep(20);
  }
}

export const run = (h: Harness, id: string): RunView => {
  const found = h.orch.state().runs.find((r) => r.id === id);
  if (!found) throw new Error(`run ${id} missing`);
  return found;
};

export const assign = (h: Harness, ticketId: string, profileId = "opus") =>
  h.orch.assign({ projectId: "p1", ticketId, profileId, brief: "" });
