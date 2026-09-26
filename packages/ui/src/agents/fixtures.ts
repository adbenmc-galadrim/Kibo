import {
  type AgentProfile,
  type AgentsState,
  DEFAULT_WORKFLOW,
  type Domain,
  type Guideline,
  type ProjectSnapshot,
  type ProjectSummary,
  type RunView,
  type TicketView,
  type WorkspaceConfig,
} from "@kibo/schema";

export const NOW = Date.UTC(2026, 8, 26, 8, 45);
const MIN = 60_000;

export function runFixture(p: Partial<RunView> & Pick<RunView, "id">): RunView {
  return {
    seq: 1,
    projectId: "kibo",
    ticketId: `t-${p.id}`,
    ticketKey: "KIB-1",
    ticketTitle: "Ticket",
    profileId: "opus",
    profileName: "opus-dev",
    sessionId: `s-${p.id}`,
    brief: "",
    createdAt: NOW - 20 * MIN,
    label: "opus-dev",
    state: "queued",
    lane: null,
    priority: false,
    rank: 0,
    question: null,
    pendingAnswer: null,
    lastActivity: null,
    subagents: [],
    workspace: null,
    guidelines: 0,
    transcriptPath: null,
    tokens: 0,
    costUsd: 0,
    denied: [],
    error: null,
    output: null,
    stateSince: NOW - 5 * MIN,
    startedAt: null,
    endedAt: null,
    turns: 0,
    ...p,
  };
}

export const profilesFixture: AgentProfile[] = [
  {
    id: "opus",
    name: "opus-dev",
    model: "opus",
    execution: "cli",
    permissionMode: "acceptEdits",
    workspace: "worktree",
    maxParallel: 2,
    subagents: ["sonnet", "haiku"],
  },
  {
    id: "sonnet",
    name: "sonnet-review",
    model: "sonnet",
    execution: "cli",
    permissionMode: "plan",
    workspace: "isolated",
    maxParallel: 3,
    subagents: [],
  },
  {
    id: "haiku",
    name: "haiku-tests",
    model: "haiku",
    execution: "cli",
    permissionMode: "acceptEdits",
    workspace: "worktree",
    maxParallel: 1,
    subagents: [],
  },
];

export function agentsFixture(): AgentsState {
  const sonnet = { profileId: "sonnet", profileName: "sonnet-review" };
  return {
    runs: [
      runFixture({
        id: "r44",
        seq: 44,
        ...sonnet,
        ticketKey: "KIB-7",
        ticketTitle: "Tokens shadcn + thème sombre",
        label: "sonnet-review-1",
        lane: 1,
        state: "running",
        startedAt: NOW - MIN,
        tokens: 3_000,
      }),
      runFixture({
        id: "r43",
        seq: 43,
        ticketKey: "KIB-16",
        ticketTitle: "Moteur de règles déclaratif",
        label: "opus-dev-3",
        lane: 3,
        state: "running",
        startedAt: NOW - 4 * MIN,
        tokens: 9_000,
      }),
      runFixture({
        id: "r42",
        seq: 42,
        ticketKey: "KIB-12",
        ticketTitle: "Schéma Loro des tickets",
        label: "opus-dev-1",
        lane: 1,
        state: "running",
        startedAt: NOW - 12 * MIN,
        tokens: 48_000,
        subagents: [{ id: "a1", type: "haiku-tests", since: NOW - 2 * MIN }],
      }),
      runFixture({
        id: "r41",
        seq: 41,
        ticketKey: "KIB-14",
        ticketTitle: "Récepteur de hooks Claude Code",
        label: "opus-dev-2",
        lane: 2,
        state: "waiting_input",
        question: "Quel port pour le récepteur ? 4747 (défaut) ou dynamique ?",
        startedAt: NOW - 3 * MIN,
        stateSince: NOW - MIN,
        workspace: "worktree:kib-14",
        guidelines: 3,
        tokens: 21_000,
      }),
      runFixture({
        id: "q10",
        seq: 45,
        ticketKey: "KIB-10",
        ticketTitle: "Watcher git et gh",
        rank: -1,
        priority: true,
        pendingAnswer: "Oui, utilise gh.",
      }),
      runFixture({
        id: "q18",
        seq: 46,
        ticketKey: "KIB-18",
        ticketTitle: "Adaptateur GitHub Issues",
        rank: 10,
      }),
      runFixture({ id: "q29", seq: 47, ticketKey: "KIB-29", ticketTitle: "Migration v0 → v1", rank: 11 }),
      runFixture({
        id: "r40",
        seq: 40,
        ...sonnet,
        ticketKey: "KIB-11",
        ticketTitle: "Démon : auth par jeton local",
        label: "sonnet-review-1",
        state: "done",
        startedAt: NOW - 82 * MIN,
        endedAt: NOW - 41 * MIN,
        tokens: 96_000,
      }),
      runFixture({
        id: "r39",
        seq: 39,
        ticketKey: "KIB-7",
        ticketTitle: "Tokens shadcn",
        label: "opus-dev-1",
        state: "failed",
        error: "exit code 1",
        startedAt: NOW - 120 * MIN,
        endedAt: NOW - 93 * MIN,
        tokens: 63_000,
      }),
    ],
    queue: [
      { runId: "q10", position: 1, reason: { kind: "profile", profileName: "opus-dev", used: 2, total: 2 } },
      { runId: "q18", position: 2, reason: { kind: "profile", profileName: "opus-dev", used: 2, total: 2 } },
      { runId: "q29", position: 3, reason: { kind: "host", used: 3, total: 3 } },
    ],
    host: {
      hostSlots: 3,
      cpuThreshold: 85,
      ramThreshold: 90,
      paused: false,
      autoSlots: 3,
      slotsFixed: false,
      cores: 8,
      ramGb: 16,
      used: 3,
      cpu: 62,
      ram: 70,
    },
    tokensToday: 1_200_000,
  };
}

export const domainsFixture: Domain[] = [
  { id: "core", name: "Core", color: "#14B8A6" },
  { id: "agents", name: "Agents", color: "#6366F1" },
  { id: "ui", name: "UI", color: "#EC4899" },
  { id: "securite", name: "Sécurité", color: "#B45309" },
  { id: "devops", name: "DevOps", color: "#64748B" },
  { id: "integrations", name: "Intégrations", color: "#84CC16" },
  { id: "facturation", name: "Facturation", color: "#D946EF" },
];

const CORE = [
  "# Guidelines — domaine Core",
  "",
  "- Toute entité partagée a un schéma Zod dans packages/core/schema.",
  "- Les arbres (tickets, pages) utilisent LoroTree ; jamais de parentId manuel.",
  "- Toute mutation passe par une commande du démon, jamais par l'UI directe.",
  "- Tests de convergence obligatoires pour une nouvelle opération CRDT.",
  "",
  "## À ne pas faire",
  "- Écrire un état d'agent depuis un LLM.",
  "- Stocker un secret dans un doc Loro.",
].join("\n");

const guideline = (
  id: string,
  owner: Guideline["owner"],
  path: string,
  content = `# ${path}`,
): Guideline => ({
  id,
  owner,
  path,
  content,
});

export function configFixture(): WorkspaceConfig {
  const kibo = { scope: "project", projectId: "kibo" } as const;
  const core = { scope: "domain", domainId: "core" } as const;
  return {
    profiles: profilesFixture,
    domains: domainsFixture,
    guidelines: [
      guideline("w1", { scope: "workspace" }, "guidelines/general.md"),
      guideline("w2", { scope: "workspace" }, "guidelines/git.md"),
      guideline("p1", kibo, "guidelines/kibo.md"),
      guideline("p2", kibo, "guidelines/tests.md"),
      guideline("p3", kibo, "guidelines/ui.md"),
      guideline("c1", core, "guidelines/core.md", CORE),
      guideline("c2", core, "skills/loro-patterns.md"),
      guideline("c3", core, "guidelines/tests.md"),
    ],
    domainUsage: { core: 9, agents: 3, ui: 2, securite: 3, devops: 3, integrations: 2 },
  };
}

const ticket = (p: Partial<TicketView> & Pick<TicketView, "id" | "key" | "title">): TicketView => ({
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  ...p,
});

export function kiboProject(): ProjectSnapshot {
  return {
    meta: { id: "kibo", key: "KIB", name: "Kibo", folder: "/Users/adam/goinfre/Kibo", color: "#F97316" },
    workflow: DEFAULT_WORKFLOW,
    pages: [],
    tickets: [
      ticket({
        id: "t12",
        key: "KIB-12",
        title: "Schéma Loro des tickets (LoroTree)",
        statusId: "in_progress",
        domainId: "core",
        assignee: { kind: "agent", ref: "opus-dev" },
      }),
      ticket({
        id: "t14",
        key: "KIB-14",
        title: "Récepteur de hooks Claude Code",
        statusId: "in_progress",
        domainId: "agents",
      }),
      ticket({
        id: "t15",
        key: "KIB-15",
        title: "Kanban : drag & drop entre colonnes",
        domainId: "ui",
        waitingOn: ["KIB-12"],
      }),
      ticket({
        id: "t5",
        key: "KIB-5",
        title: "Monorepo Bun workspaces",
        statusId: "done",
        domainId: "devops",
      }),
    ],
    links: [{ id: "l1", from: "t12", to: "t15", type: "blocks" }],
    instances: [],
    rules: [],
    nextTicketKey: "KIB-30",
  };
}

export const projectsFixture: ProjectSummary[] = [
  {
    id: "kibo",
    key: "KIB",
    name: "Kibo",
    folder: "/Users/adam/goinfre/Kibo",
    color: "#F97316",
    counts: { backlog: 1, todo: 3, in_progress: 4, in_review: 2, blocked: 1, done: 2 },
  },
  {
    id: "fac",
    key: "FAC",
    name: "API Facturation",
    folder: null,
    color: "#22C55E",
    counts: { backlog: 0, todo: 1, in_progress: 1, in_review: 0, blocked: 0, done: 0 },
  },
];
