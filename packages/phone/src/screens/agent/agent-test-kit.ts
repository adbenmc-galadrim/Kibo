import type { AgentSnapshot } from "@kibo/remote";
import {
  type Batch,
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ProjectAgentSessionView,
  type ProjectSnapshot,
  type RunLogEntry,
  type TicketView,
} from "@kibo/schema";

const MIN = 60_000;
export const POINT_AT = new Date(2026, 9, 16, 14, 38).getTime();
const SPRINT_S41_AT = new Date(2026, 9, 9, 9, 12).getTime();
const RELANCES_AT = new Date(2026, 9, 2, 10, 5).getTime();

const ticket = (id: string, key: string, title: string): TicketView => ({
  id,
  key,
  hold: null,
  keyLabel: key,
  title,
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

export function siloAgentProject(): ProjectSnapshot {
  return {
    meta: {
      id: "silo",
      key: "SILO",
      name: "Silo",
      folder: null,
      color: "#14B8A6",
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
      ticket("t30", "SILO-30", "Envoi hors ligne"),
      ticket("t90", "SILO-90", "Tableau de bord gérant"),
      ticket("t33", "SILO-33", "Écran d'envoi hors ligne"),
    ],
    links: [],
    questions: [],
    questionRecipients: [],
    instances: [],
    rules: [],
    bindings: [],
    nextTicketKey: "SILO-91",
    sprints: [],
  };
}

export function lotSeven(over: Partial<Batch> = {}): Batch {
  return {
    id: "b7",
    projectId: "silo",
    runId: "pa7",
    sessionId: "s-pa7",
    seq: 7,
    summary: "Replanifier F5 et F9",
    actions: [
      {
        id: 1,
        type: "setSprint",
        ticket: "SILO-30",
        sprint: "S43",
        why: "4 étapes restantes, S42 finit aujourd'hui",
      },
      { id: 2, type: "setSprint", ticket: "SILO-90", sprint: "S44", why: "seule fonctionnalité à planifier" },
      { id: 3, type: "setStatus", ticket: "SILO-33", statusId: "in_review", why: "la PR #22 est ouverte" },
    ],
    expected: [],
    createdAt: POINT_AT + 2 * MIN,
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    chosen: null,
    comment: null,
    results: [],
    ...over,
  };
}

const sessionView = (
  runId: string,
  title: string,
  startedAt: number,
  messages: number,
  closed: boolean,
): ProjectAgentSessionView => ({
  projectId: "silo",
  runId,
  sessionId: `s-${runId}`,
  startedAt,
  closedAt: closed ? startedAt + 30 * MIN : null,
  lastTurnAt: startedAt + 5 * MIN,
  title,
  messages,
});

const exchange = (question: string, answer: string, at: number): RunLogEntry[] => [
  { id: 1, at, event: { type: "answered", text: question, rank: 0 } },
  {
    id: 2,
    at: at + MIN,
    event: { type: "exited", code: 0, isError: false, result: answer, tokens: 10, costUsd: 0, denied: [] },
  },
];

const POINT_ANSWER =
  "F3 est livrée : 3 fonctionnalités sur 9.\n\nS42 finit ce soir et F5 n'y tiendra pas : il lui reste 4 étapes sur 5.";
export const SPRINT_ANSWER = "S41 est bouclé : 2 fonctionnalités livrées, F4 glisse en S42.";

export function siloAgentSnapshot(batch: Batch = lotSeven()): AgentSnapshot {
  return {
    view: {
      session: sessionView("pa7", "Fais le point du jour", POINT_AT, 4, false),
      run: null,
      batches: [batch],
      past: [
        sessionView("pa6", "Point de sprint S41", SPRINT_S41_AT, 6, true),
        sessionView("pa5", "Relances client", RELANCES_AT, 3, true),
      ],
      memoryPath: "",
    },
    logs: {
      pa7: exchange("Fais le point du jour", POINT_ANSWER, POINT_AT),
      pa6: exchange("Où en est le sprint S41 ?", SPRINT_ANSWER, SPRINT_S41_AT),
      pa5: exchange("Qui relancer chez Silo SA ?", "Silo SA doit répondre à Q14.", RELANCES_AT),
    },
    pastBatches: {
      pa6: [
        lotSeven({
          id: "b6",
          runId: "pa6",
          sessionId: "s-pa6",
          seq: 6,
          createdAt: SPRINT_S41_AT + 2 * MIN,
          status: "applied",
          decidedBy: { kind: "human", ref: "adam" },
          decidedAt: SPRINT_S41_AT + 3 * MIN,
          chosen: [1, 2, 3],
        }),
      ],
    },
  };
}
