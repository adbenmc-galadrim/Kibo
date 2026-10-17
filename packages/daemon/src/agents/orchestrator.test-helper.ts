import { afterEach } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type Agent,
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type Guideline,
  type HostLoad,
  KiboError,
  type ProjectSnapshot,
  type Question,
  type RunView,
  type Skill,
  type TicketView,
  undeliveredAnswers,
} from "@kibo/schema";
import { agentsPort, testAgent, testRef } from "./agents-port.test-helper";
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
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
});

const childTickets = (children: ReadonlyMap<string, number>): TicketView[] =>
  [...children].flatMap(([parentId, count]) =>
    Array.from({ length: count }, (_, n) => ({ ...ticket(`${parentId}-${n}`, null), parentId })),
  );

export const testProject: ProjectSnapshot = {
  meta: {
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [...[1, 2, 3, 4].map((n) => ticket(`t${n}`, `KIB-${n}`)), ticket("pending", null)],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-5",
  sprints: [],
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

export { projectAgentAgent, testAgent } from "./agents-port.test-helper";

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
  delivered: Delivery[];
  prepared: string[];
  children: Map<string, number>;
  route: (target: Orchestrator) => void;
  stopServer: () => void;
};

export type Delivery = { ticketId: string; questionIds: string[]; runId: string };

type Setup = {
  scenario: FakeScenarioName;
  profiles?: Agent[];
  load?: () => HostLoad;
  claudeBin?: string | null;
  env?: Record<string, string>;
  guidelines?: Guideline[];
  readOnly?: boolean;
  assignFails?: boolean;
  demoProject?: boolean;
  demoAgent?: OrchestratorOptions["demoAgent"];
  meta?: Partial<ProjectSnapshot["meta"]>;
  questions?: Question[];
  markFails?: boolean;
  lifecycle?: Pick<OrchestratorOptions, "onSpawned" | "onTurnEnd" | "onEndedWithoutTurn">;
  cliFallbacks?: OrchestratorOptions["cliFallbacks"];
  skills?: Skill[];
  locks?: OrchestratorOptions["locks"];
  children?: Record<string, number>;
  externalRefs?: Record<string, TicketView["externalRefs"]>;
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
  const delivered: Delivery[] = [];
  const prepared: string[] = [];
  const projectDir = join(home, "project");
  mkdirSync(projectDir);
  const questions = o.questions ?? [];
  const children = new Map(Object.entries(o.children ?? {}));
  const profiles = o.profiles ?? [testAgent()];
  const data: AgentDataPort = {
    ...agentsPort(profiles),
    projectKey: () => testProject.meta.key,
    skills: () => o.skills ?? [],
    ticketContext: (projectId, ticketId) => {
      const found = testProject.tickets.find((x) => x.id === ticketId);
      const t = found && { ...found, externalRefs: o.externalRefs?.[ticketId] ?? found.externalRefs };
      if (projectId !== "p1" || !t) throw new KiboError("NOT_FOUND", `ticket ${ticketId} not found`);
      const meta = { ...testProject.meta, ...o.meta };
      const tickets = [...testProject.tickets, ...childTickets(children)];
      const project = { ...testProject, meta, questions, tickets };
      return { project, ticket: t, domain: null, childCount: children.get(ticketId) ?? 0 };
    },
    guidelines: () => o.guidelines ?? [],
    assertWritable: (projectId) => {
      if (o.readOnly) throw new KiboError("FORBIDDEN", `project ${projectId} is read-only`);
    },
    assignTicket: (_projectId, ticketId, name) => {
      if (o.assignFails) throw new KiboError("INVALID_INPUT", "ticket write refused");
      assigned.push(`${ticketId}:${name}`);
    },
    runStarted: (_projectId, ticketId) => {
      started.push(ticketId);
    },
    runDone: (_projectId, ticketId) => {
      done.push(ticketId);
    },
    isDemoProject: () => o.demoProject ?? false,
    createQuestion: () => null,
    answerRunQuestion: () => null,
    runQuestions: () => [],
    undeliveredAnswers: (_projectId, ticketId) => undeliveredAnswers(questions, ticketId),
    markAnswersDelivered: (_projectId, ticketId, questionIds, runId) => {
      if (o.markFails) throw new KiboError("INVALID_INPUT", "delivery refused");
      delivered.push({ ticketId, questionIds: [...questionIds], runId });
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
    demoAgent: o.demoAgent ?? { bin: FAKE_CLAUDE, env: () => ({}) },
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
    projectTurns: {
      prepare: async (run) => {
        prepared.push(run.id);
        return {
          cwd: projectDir,
          systemPrompt: "# rôle",
          prompt: `[tour ${run.turns + 1}] ${run.pendingAnswer}`,
        };
      },
    },
    newToken: (runId) => {
      const minted = newRunToken();
      tokens.set(runId, minted.token);
      return minted;
    },
    ...o.lifecycle,
    cliFallbacks: o.cliFallbacks,
    locks: o.locks,
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
    delivered,
    prepared,
    children,
    route: (target) => {
      orch = target;
    },
    stopServer: () => server.stop(true),
  };
  return current;
}

export const knownSkill = (id: string): Skill => ({
  id,
  source: "user",
  projectId: null,
  plugin: null,
  name: id,
  description: "",
  path: `/skills/${id}`,
  file: null,
  problem: null,
  hash: null,
  readOnly: false,
  shadowedBy: null,
  files: [],
  usage: { last: null, runs30d: 0 },
  reviews: { open: 0 },
  modifiedAt: null,
});

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

export const assign = (h: Harness, ticketId: string, profileId = "opus", fresh = false) =>
  h.orch.assign({ projectId: "p1", ticketId, profileId: testRef(profileId), brief: "", fresh });
