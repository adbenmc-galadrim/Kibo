import {
  type AgentProfile,
  DEFAULT_WORKFLOW,
  type Link,
  type ProjectSnapshot,
  type Question,
  type RunView,
  type TicketView,
} from "@kibo/schema";

export const PROJECT_ID = "p1";
export const HUMAN = { kind: "human" as const, ref: "adam" };

export function ticket(p: Partial<TicketView> & Pick<TicketView, "id">): TicketView {
  const key = p.key === undefined ? `EMIS-${p.id.replace(/\D/g, "") || "1"}` : p.key;
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
    progress: { done: 0, total: 0 },
    waitingOn: [],
    keyLabel: key ?? "EMIS-…",
    openQuestions: 0,
    ...p,
  };
}

export function question(p: Partial<Question> & Pick<Question, "id" | "ticketId">): Question {
  return {
    runId: null,
    title: `Question ${p.id}`,
    context: "",
    options: [],
    provisional: null,
    blocking: false,
    createdBy: { kind: "agent", ref: "opus" },
    createdAt: 0,
    importRef: null,
    answer: null,
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
    meta: { id: PROJECT_ID, key: "EMIS", name: "Emis", folder: null, color: "#14B8A6", worktree: null },
    workflow: DEFAULT_WORKFLOW,
    pages: [],
    tickets: [],
    links: [],
    questions: [],
    instances: [],
    rules: [],
    bindings: [],
    nextTicketKey: null,
    sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
    ...p,
  };
}

let seq = 0;
export function run(p: Partial<RunView> & Pick<RunView, "id">): RunView {
  seq += 1;
  return {
    seq,
    kind: "ticket",
    projectId: PROJECT_ID,
    ticketId: null,
    ticketKey: null,
    ticketTitle: "Ticket",
    profileId: "opus",
    profileName: "opus-dev",
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

export function profile(p: Partial<AgentProfile> & Pick<AgentProfile, "id">): AgentProfile {
  return {
    name: p.id,
    model: "opus",
    execution: "cli",
    permissionMode: "default",
    workspace: "worktree",
    maxParallel: 1,
    subagents: [],
    enabled: true,
    allow: [],
    system: false,
    ...p,
  };
}

export const PROFILES: AgentProfile[] = [
  profile({ id: "opus", name: "opus-dev" }),
  profile({ id: "off", name: "off-dev", enabled: false }),
  profile({ id: "assistant", system: true, workspace: "isolated" }),
  profile({ id: "demo", system: true, workspace: "isolated" }),
  profile({ id: "project-agent", system: true, workspace: "isolated" }),
];
