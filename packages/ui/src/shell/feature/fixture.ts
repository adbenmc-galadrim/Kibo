import {
  DEFAULT_RECIPIENTS,
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ExternalRef,
  featureState,
  featureSteps,
  type Link,
  type ProjectSnapshot,
  type Question,
  type SprintView,
  type TicketView,
} from "@kibo/schema";

export const NOW = new Date(2026, 9, 16, 14, 52).getTime();
const at = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m).getTime();

const ticket = (id: string, key: string, title: string, patch: Partial<TicketView> = {}): TicketView => ({
  id,
  key,
  pendingSeq: null,
  keyLabel: key,
  title,
  description: "",
  statusId: "todo",
  parentId: "f5",
  assignee: null,
  domainId: null,
  blockedReason: null,
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
  effectiveSprintId: "s42",
  session: null,
  updatedAt: null,
  feature: null,
  ...patch,
});

const pr = (number: number, state: "open" | "merged"): ExternalRef => ({
  kind: "github_pr",
  url: `https://github.com/galadrim/emis/pull/${number}`,
  number,
  state,
  base: "main",
  head: null,
  review: "none",
  checks: "ok",
});

const step = (n: number, day: number, h: number, m: number) => ({
  step: n,
  note: "",
  at: at(day, h, m),
  runId: null,
  kind: "delivery" as const,
});

const sprint = (
  id: string,
  code: string,
  name: string,
  start: string,
  end: string,
  state: SprintView["state"],
): SprintView => ({
  id,
  code,
  name,
  start,
  end,
  state,
  features: [],
  delivered: 0,
  total: 0,
});

export const SPRINTS: SprintView[] = [
  sprint("s41", "S41", "Accès", "2026-10-05", "2026-10-09", "done"),
  sprint("s42", "S42", "Terrain hors ligne", "2026-10-12", "2026-10-16", "current"),
  sprint("s43", "S43", "Import et soudures", "2026-10-19", "2026-10-23", "planned"),
  sprint("s44", "S44", "Rapports", "2026-10-26", "2026-10-30", "planned"),
];

const STEPS: TicketView[] = [
  ticket("e31", "EMIS-31", "Stockage des photos sur MinIO", {
    statusId: "done",
    externalRefs: [pr(19, "merged")],
    delivery: step(11, 15, 18, 22),
  }),
  ticket("e32", "EMIS-32", "Route d'envoi des photos", {
    statusId: "in_review",
    externalRefs: [pr(22, "open")],
    delivery: step(10, 16, 15, 4),
  }),
  ticket("e33", "EMIS-33", "Écran d'envoi hors ligne", {
    statusId: "in_progress",
    externalRefs: [{ kind: "git_branch", branch: "feat/envoi-hors-ligne", base: null }],
    delivery: step(7, 16, 14, 51),
    session: { tool: "T3 Code", startedAt: NOW - 42 * 60_000 },
  }),
  ticket("e34", "EMIS-34", "Tests E2E de l'envoi", { openQuestions: 1 }),
  ticket("e35", "EMIS-35", "Démo client"),
];

const LINKS: Link[] = [
  { id: "l1", from: "e31", to: "e32", type: "blocks" },
  { id: "l2", from: "e32", to: "e33", type: "blocks" },
  { id: "l3", from: "e33", to: "e34", type: "blocks" },
  { id: "l4", from: "e34", to: "e35", type: "blocks" },
  { id: "l5", from: "f3", to: "f5", type: "blocks" },
  { id: "l6", from: "f5", to: "f7", type: "blocks" },
];

const feature = (steps: readonly TicketView[], id: string, sprintEnd: string, today: string) =>
  featureState({
    steps: featureSteps({ feature: id, tickets: steps, links: LINKS }),
    blockingQuestions: new Set(),
    sprint: { end: sprintEnd },
    today,
  });

const F5 = ticket("f5", "EMIS-30", "Envoyer les photos d'un tronçon", {
  parentId: null,
  statusId: "in_progress",
  shortKey: "F5",
  sprintId: "s42",
  description:
    "Sur le terrain, sans réseau, un chef de chantier photographie un tronçon. Les photos partent seules au retour du réseau et apparaissent dans le dossier de l'affaire.",
  progress: { done: 1, total: 5 },
  feature: feature(STEPS, "f5", "2026-10-16", "2026-10-16"),
});

const F3_STEP = ticket("e21", "EMIS-21", "Réaffecter", { parentId: "f3", statusId: "done" });
const F3 = ticket("f3", "EMIS-20", "Réaffecter un ISO", {
  parentId: null,
  statusId: "done",
  shortKey: "F3",
  sprintId: "s42",
  progress: { done: 1, total: 1 },
  feature: feature([F3_STEP], "f3", "2026-10-16", "2026-10-16"),
});
const F7_STEP = ticket("e71", "EMIS-71", "Rapport", { parentId: "f7", effectiveSprintId: "s44" });
const F7 = ticket("f7", "EMIS-70", "Rapport de chantier", {
  parentId: null,
  shortKey: "F7",
  sprintId: "s44",
  effectiveSprintId: "s44",
  progress: { done: 0, total: 1 },
  feature: feature([F7_STEP], "f7", "2026-10-30", "2026-10-16"),
});

const Q16: Question = {
  kind: "question",
  images: [],
  id: "q16",
  ticketId: "e34",
  runId: null,
  title: "Quota par affaire : 2 Go ou 5 Go ?",
  context: "",
  options: ["2 Go", "5 Go"],
  provisional: null,
  blocking: false,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: at(15, 10, 0),
  importRef: { kind: "import_ref", source: "plan", id: "Q16" },
  answer: null,
  recipient: "product",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
};

export function emisFeatureProject(): ProjectSnapshot {
  return {
    meta: {
      id: "emis",
      name: "Emis",
      key: "EMIS",
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
    links: LINKS,
    questions: [Q16],
    questionRecipients: [...DEFAULT_RECIPIENTS],
    instances: [],
    rules: [],
    bindings: [],
    nextTicketKey: "EMIS-94",
    sprints: SPRINTS,
    sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
    tickets: [F3, F3_STEP, F5, ...STEPS, F7, F7_STEP],
  };
}

export const SESSION_RUN = {
  ticketId: "e33",
  state: "running" as const,
  agentName: "T3 Code",
  startedAt: NOW - 42 * 60_000,
  createdAt: NOW - 45 * 60_000,
};
