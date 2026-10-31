import {
  type Batch,
  DEFAULT_RECIPIENTS,
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type HookPayload,
  MEMORY_NOTE_PATH,
  type ProjectAgentSessionView,
  type ProjectAgentView,
  type ProjectSnapshot,
  type ProposedAction,
  type Question,
  type RunLogEntry,
  type RunView,
  type TicketView,
} from "@kibo/schema";
import { NOW, runFixture } from "../lib/fixtures";

const MIN = 60_000;

const ticket = (id: string, key: string, title: string, statusId: TicketView["statusId"]): TicketView => ({
  id,
  key,
  hold: null,
  keyLabel: key,
  title,
  description: "",
  statusId,
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
  startReason: null,
  onHold: null,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  thread: null,
  updatedAt: null,
  feature: null,
});

export function siloProject(): ProjectSnapshot {
  return {
    meta: {
      id: "silo",
      key: "SILO",
      name: "Silo",
      folder: null,
      color: "#0EA5E9",
      worktree: null,
      storybook: null,
      delivery: null,
      tracking: null,
      description: null,
      client: null,
    },
    workflow: DEFAULT_WORKFLOW,
    pages: [],
    tickets: [
      ticket("t11", "SILO-11", "Import des factures", "in_progress"),
      ticket("t12", "SILO-12", "Export CSV", "todo"),
    ],
    links: [],
    questions: [],
    questionRecipients: [],
    instances: [],
    rules: [],
    bindings: [],
    nextTicketKey: "SILO-13",
    sprints: [],
  };
}

export function projectRun(p: Partial<RunView> = {}): RunView {
  return runFixture({
    id: "pa1",
    kind: "project",
    projectId: "silo",
    ticketId: null,
    ticketKey: null,
    ticketTitle: "Agent de projet · Silo",
    profileId: "system:project-agent",
    profileName: "project-agent",
    label: "project-agent",
    state: "done",
    turns: 3,
    ...p,
  });
}

export const hook = (
  event: HookPayload["event"],
  tool: string | null,
  detail: string | null,
): HookPayload => ({
  event,
  sessionId: "s-pa1",
  transcriptPath: null,
  tool,
  detail,
  question: null,
  agentId: null,
  toolUseId: null,
  ask: null,
  todos: null,
  stopHookActive: false,
});

const spawned = (id: number, at: number): RunLogEntry => ({
  id,
  at,
  event: { type: "spawned", pid: 7, resume: id > 3, workspace: "/tmp/silo", guidelines: 0 },
});

const exited = (id: number, at: number, result: string): RunLogEntry => ({
  id,
  at,
  event: { type: "exited", code: 0, isError: false, result, tokens: 10, costUsd: 0, denied: [] },
});

export const CONVERSATION_LOG: RunLogEntry[] = [
  { id: 1, at: NOW - 30 * MIN, event: { type: "answered", text: "Où en est-on ?", rank: 0 } },
  spawned(2, NOW - 29 * MIN),
  {
    id: 3,
    at: NOW - 29 * MIN,
    event: { type: "hook", payload: hook("PreToolUse", "mcp__kibo__list_tickets", null) },
  },
  {
    id: 4,
    at: NOW - 29 * MIN,
    event: { type: "hook", payload: hook("PostToolUse", "mcp__kibo__list_tickets", null) },
  },
  {
    id: 5,
    at: NOW - 28 * MIN,
    event: { type: "hook", payload: hook("PostToolUse", "mcp__kibo__get_ticket", "SILO-11") },
  },
  exited(6, NOW - 27 * MIN, "**SILO-11** avance ; je propose de le passer en review."),
  { id: 7, at: NOW - 10 * MIN, event: { type: "answered", text: "Et l'export ?", rank: 0 } },
  spawned(8, NOW - 9 * MIN),
  { id: 9, at: NOW - 8 * MIN, event: { type: "failed", error: "INTERRUPTED: daemon stopped" } },
];

const actions: ProposedAction[] = [
  {
    id: 1,
    type: "createTicket",
    ref: "new:1",
    title: "Tests de l'import",
    why: "Couvrir l'import avant la review",
  },
  { id: 2, type: "setStatus", ticket: "SILO-11", statusId: "in_review", why: "Le code est prêt" },
  {
    id: 3,
    type: "updateTicket",
    ticket: "SILO-12",
    title: "Export CSV des factures",
    why: "Titre plus précis",
  },
  { id: 4, type: "setStatus", ticket: "SILO-12", statusId: "in_progress", why: "Quelqu'un s'y met" },
  {
    id: 5,
    type: "createQuestion",
    ticket: "SILO-12",
    title: "Séparateur ; ou , ?",
    options: ["Point-virgule", "Virgule"],
    why: "Choix d'Adam",
  },
  { id: 6, type: "answerQuestion", questionId: "q1", answer: { kind: "confirm" }, why: "Déjà validé hier" },
  {
    id: 7,
    type: "updateNote",
    path: MEMORY_NOTE_PATH,
    content: "# Mémoire\n- SILO-11 en review",
    why: "Mémoire",
  },
];

export function pendingBatch(p: Partial<Batch> = {}): Batch {
  return {
    id: "b1",
    projectId: "silo",
    runId: "pa1",
    sessionId: "s-pa1",
    seq: 1,
    summary: "Passer SILO-11 en review et lancer l'export",
    actions,
    expected: [
      { actionId: 2, fields: { statusId: "in_progress" } },
      { actionId: 3, fields: { title: "Export CSV" } },
      { actionId: 7, fields: { hash: "abc" } },
    ],
    createdAt: NOW - 28 * MIN,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    chosen: null,
    comment: null,
    results: [],
    ...p,
  };
}

export function partialBatch(): Batch {
  return pendingBatch({
    id: "b0",
    seq: 0,
    createdAt: NOW - 40 * MIN,
    status: "partial",
    decidedBy: { kind: "human", ref: "adam" },
    decidedAt: NOW - 35 * MIN,
    chosen: [1, 2, 3, 4, 6],
    results: [
      { actionId: 1, outcome: "applied", detail: null, created: { ticketId: "t13", key: "SILO-13" } },
      { actionId: 2, outcome: "applied", detail: null, created: null },
      { actionId: 3, outcome: "stale", detail: "titre modifié depuis la proposition", created: null },
      { actionId: 4, outcome: "failed", detail: "profil désactivé", created: null },
      { actionId: 5, outcome: "skipped", detail: null, created: null },
      { actionId: 6, outcome: "applied", detail: null, created: null },
      { actionId: 7, outcome: "skipped", detail: null, created: null },
    ],
  });
}

export const PAST_STARTED_AT = new Date(2026, 9, 2, 10, 5).getTime();

export const session = (p: Partial<ProjectAgentSessionView> = {}): ProjectAgentSessionView => ({
  projectId: "silo",
  runId: "pa1",
  sessionId: "s-pa1",
  startedAt: NOW - 30 * MIN,
  closedAt: null,
  lastTurnAt: NOW - 8 * MIN,
  title: "Où en est-on ?",
  messages: 2,
  ...p,
});

export function viewFixture(p: Partial<ProjectAgentView> = {}): ProjectAgentView {
  return {
    session: session({ title: "Fais le point du jour", messages: 2 }),
    run: projectRun({ state: "failed" }),
    batches: [pendingBatch()],
    past: [
      session({
        runId: "r1",
        sessionId: "s-r1",
        title: "Relances client",
        messages: 3,
        startedAt: PAST_STARTED_AT,
        closedAt: PAST_STARTED_AT + 60 * MIN,
        lastTurnAt: PAST_STARTED_AT + 30 * MIN,
      }),
    ],
    memoryPath: MEMORY_NOTE_PATH,
    ...p,
  };
}

export const emptyView = (): ProjectAgentView =>
  viewFixture({ session: null, run: null, batches: [], past: [] });

const asked = (id: string, ticketId: string, title: string, recipient: string): Question => ({
  kind: "question",
  images: [],
  id,
  ticketId,
  runId: null,
  title,
  context: "Le logo actuel est **trop petit** sur mobile.",
  options: ["Oui", "Non"],
  provisional: null,
  blocking: false,
  createdBy: { kind: "agent", ref: "opus-dev-1" },
  createdAt: 1,
  number: null,
  importRef: null,
  answer: null,
  recipient,
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
});

export function questionsProject(): ProjectSnapshot {
  return {
    ...siloProject(),
    questions: [
      asked("q-logo", "t11", "Client - Logo ?", "client"),
      asked("q-port", "t12", "Quel port ?", "me"),
    ],
    questionRecipients: [...DEFAULT_RECIPIENTS, { id: "galadrim", name: "Galadrim" }],
  };
}
