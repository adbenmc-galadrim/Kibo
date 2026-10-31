import {
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type FeatureState,
  type ProjectSnapshot,
  type ProjectSummary,
  type Question,
  type SprintView,
  type StatusId,
  type TicketView,
} from "@kibo/schema";

export const TODAY = "2026-10-17";

export const ticket = (p: Partial<TicketView> & Pick<TicketView, "id" | "key" | "title">): TicketView => ({
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
  hold: null,
  keyLabel: p.key ?? "",
  ...p,
});

const sprint = (id: string, code: string, start: string, end: string): SprintView => ({
  id,
  code,
  name: `Sprint ${code}`,
  start,
  end,
  state: end < TODAY ? "done" : start <= TODAY ? "current" : "planned",
  features: [],
  delivered: 0,
  total: 0,
  lingering: false,
});

const lateFeature: FeatureState = {
  status: "late",
  steps: { done: 1, total: 8, mandatoryDone: 1, mandatoryTotal: 8 },
  nextStepId: "s1",
  remaining: 7,
  started: true,
  held: 0,
};

const STEP_STATUSES: readonly StatusId[] = [
  "blocked",
  "blocked",
  "blocked",
  "blocked",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

const steps = STEP_STATUSES.map((statusId, i) =>
  ticket({ id: `s${i + 1}`, key: `SILO-${i + 1}`, title: `Étape ${i + 1}`, statusId, parentId: "f5" }),
);

export const question = (p: Partial<Question> & Pick<Question, "id" | "ticketId">): Question => ({
  runId: null,
  title: "Format des photos ?",
  context: "",
  options: [],
  provisional: null,
  blocking: true,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: 0,
  number: 14,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  kind: "question",
  images: [],
  ...p,
});

export function siloSnapshot(): ProjectSnapshot {
  return {
    meta: {
      id: "silo",
      key: "SILO",
      name: "Silo",
      folder: "/Users/adam/Documents/silo",
      color: "#14B8A6",
      worktree: null,
      storybook: null,
      delivery: null,
      tracking: null,
      description: null,
      client: "Silo SA",
    },
    workflow: DEFAULT_WORKFLOW,
    pages: [],
    tickets: [
      ticket({
        id: "f5",
        key: "F5",
        shortKey: "F5",
        title: "Envoyer les photos d'un constat",
        sprintId: "s42",
        effectiveSprintId: "s42",
        progress: { done: 1, total: 8 },
        feature: lateFeature,
      }),
      ...steps,
    ],
    links: [],
    questions: [
      question({ id: "q14", ticketId: "s5" }),
      question({
        id: "q9",
        ticketId: "s6",
        number: 9,
        answer: {
          kind: "text",
          option: null,
          text: "JPEG",
          by: { kind: "human", ref: "adam" },
          at: 1,
          deliveredAt: null,
          deliveredRunId: null,
        },
      }),
    ],
    questionRecipients: [],
    instances: [],
    rules: [],
    bindings: [],
    nextTicketKey: "SILO-9",
    sprints: [
      sprint("s42", "S42", "2026-10-12", "2026-10-16"),
      sprint("s43", "S43", "2026-10-19", "2026-10-23"),
    ],
  };
}

export function summaryOf(snapshot: ProjectSnapshot): ProjectSummary {
  const counts = { backlog: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 };
  for (const t of snapshot.tickets) counts[t.statusId] += 1;
  return { ...snapshot.meta, counts };
}
