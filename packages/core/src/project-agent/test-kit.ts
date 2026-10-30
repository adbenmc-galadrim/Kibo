import {
  type AgentSummary,
  DEFAULT_AGENT_SETTINGS,
  DEFAULT_RECIPIENTS,
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type Link,
  type ProjectSnapshot,
  type Question,
  type RunView,
  type TicketView,
} from "@kibo/schema";
import type { BatchContext } from "./expected";

export const PROJECT_ID = "p1";
export const HUMAN = { kind: "human" as const, ref: "adam" };

export function ticket(p: Partial<TicketView> & Pick<TicketView, "id">): TicketView {
  const key = p.key === undefined ? `SILO-${p.id.replace(/\D/g, "") || "1"}` : p.key;
  return {
    key,
    pendingSeq: null,
    title: `Ticket ${p.id}`,
    description: "",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
    labels: [],
    agentProgress: EMPTY_PROGRESS,
    delivery: null,
    sprintId: null,
    optional: false,
    shortKey: null,
    hold: null,
    onHold: null,
    effectiveSprintId: null,
    session: null,
    updatedAt: null,
    feature: null,
    progress: { done: 0, total: 0 },
    waitingOn: [],
    keyLabel: key ?? "SILO-…",
    openQuestions: 0,
    startable: false,
    startReason: null,
    ...p,
  };
}

export function question(p: Partial<Question> & Pick<Question, "id" | "ticketId">): Question {
  return {
    kind: "question",
    images: [],
    runId: null,
    title: `Question ${p.id}`,
    context: "",
    options: [],
    provisional: null,
    blocking: false,
    createdBy: { kind: "agent", ref: "opus" },
    createdAt: 0,
    number: null,
    importRef: null,
    answer: null,
    recipient: "me",
    sentAt: null,
    history: [],
    archivedAt: null,
    archivedBy: null,
    ...p,
  };
}

export function answered(q: Question, text = "oui", deliveredAt: number | null = null): Question {
  return {
    ...q,
    answer: {
      kind: "text",
      option: null,
      text,
      by: HUMAN,
      at: 1,
      deliveredAt,
      deliveredRunId: deliveredAt === null ? null : "r-old",
    },
  };
}

export const link = (id: string, from: string, to: string, type: Link["type"] = "blocks"): Link => ({
  id,
  from,
  to,
  type,
});

export function project(p: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    meta: {
      id: PROJECT_ID,
      key: "SILO",
      name: "Silo",
      folder: null,
      color: "#14B8A6",
      worktree: null,
      storybook: null,
      duplication: null,
      delivery: null,
      tracking: null,
      description: null,
      client: null,
    },
    workflow: DEFAULT_WORKFLOW,
    pages: [],
    tickets: [],
    links: [],
    questions: [],
    questionRecipients: [...DEFAULT_RECIPIENTS],
    instances: [],
    rules: [],
    bindings: [],
    nextTicketKey: null,
    sprints: [],
    sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
    ...p,
  };
}

let seq = 0;
export function run(p: Partial<RunView> & Pick<RunView, "id">): RunView {
  seq += 1;
  return {
    seq,
    kind: "project",
    projectId: PROJECT_ID,
    ticketId: null,
    ticketKey: null,
    ticketTitle: "Ticket",
    profileId: "global:opus-dev",
    profileName: "opus-dev",
    agentName: "opus-dev",
    agentScope: "global",
    projectKey: "SILO",
    sessionId: `s-${p.id}`,
    brief: "",
    resumedFrom: null,
    createdAt: 0,
    label: "opus-dev",
    state: "queued",
    lane: null,
    priority: false,
    rank: seq,
    question: null,
    pendingAnswer: null,
    lastActivity: null,
    subagents: [],
    workspace: null,
    cwd: null,
    guidelines: 0,
    transcriptPath: null,
    tokens: 0,
    costUsd: 0,
    denied: [],
    error: null,
    output: null,
    stateSince: 0,
    startedAt: null,
    endedAt: null,
    turns: 0,
    activeMs: 0,
    turnStartedAt: null,
    session: null,
    ...p,
  };
}

export function agent(p: Partial<AgentSummary> & Pick<AgentSummary, "ref" | "name">): AgentSummary {
  return {
    scope: "global",
    projectId: null,
    path: `/home/.claude/agents/${p.name}.md`,
    hash: null,
    problem: null,
    nameWarning: null,
    settings: DEFAULT_AGENT_SETTINGS,
    shadowedBy: null,
    activeRuns: 0,
    modifiedAt: null,
    description: `Agent ${p.name}`,
    model: "opus",
    skillsCount: null,
    subagentsCount: 0,
    ...p,
  };
}

const system = (id: string): AgentSummary =>
  agent({ ref: `system:${id}`, name: `kibo-${id}`, scope: "system", model: null });

export const AGENTS: AgentSummary[] = [
  agent({ ref: "global:opus-dev", name: "opus-dev" }),
  agent({ ref: "global:off-dev", name: "off-dev", settings: { ...DEFAULT_AGENT_SETTINGS, enabled: false } }),
  agent({ ref: "global:hidden", name: "hidden", shadowedBy: "project:x:hidden" }),
  agent({ ref: "global:broken", name: "broken", problem: "frontmatter illisible : name manquant" }),
  system("assistant"),
  system("demo"),
  system("project-agent"),
];

export const ACTIVE_RUN = "r-active";

export const questionSnapshot = (): ProjectSnapshot =>
  project({
    tickets: [ticket({ id: "t1", title: "Un" }), ticket({ id: "t2", title: "Deux" })],
    questions: [
      question({ id: "q1", ticketId: "t1", title: "A", options: ["A", "B"], provisional: "A" }),
      answered(question({ id: "q2", ticketId: "t1", title: "Deux" })),
      answered(question({ id: "q3", ticketId: "t1", title: "Trois", recipient: "client" }), "oui", 4),
      question({ id: "q4", ticketId: "t1", title: "Quatre", archivedAt: 5, archivedBy: HUMAN }),
      question({ id: "q5", ticketId: "t2", title: "Cinq", runId: ACTIVE_RUN }),
    ],
  });

export const questionContext = (p: Partial<BatchContext> = {}): BatchContext => ({
  project: questionSnapshot(),
  runs: [run({ id: ACTIVE_RUN, ticketId: "t2", ticketKey: "SILO-2", label: "opus-dev-1", state: "running" })],
  notes: [],
  viewer: "adam",
  ...p,
});
