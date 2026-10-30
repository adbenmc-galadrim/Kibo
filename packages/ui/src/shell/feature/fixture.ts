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
  hold: null,
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
  startReason: null,
  onHold: null,
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
  url: `https://github.com/silo-labs/silo-location/pull/${number}`,
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
  lingering: false,
});

export const SPRINTS: SprintView[] = [
  sprint("s41", "S41", "Accès", "2026-10-05", "2026-10-09", "done"),
  sprint("s42", "S42", "Saisie hors ligne", "2026-10-12", "2026-10-16", "current"),
  sprint("s43", "S43", "Import et contrats", "2026-10-19", "2026-10-23", "planned"),
  sprint("s44", "S44", "Rapports", "2026-10-26", "2026-10-30", "planned"),
];

const STEPS: TicketView[] = [
  ticket("e31", "SILO-31", "Stockage des photos sur MinIO", {
    statusId: "done",
    externalRefs: [pr(19, "merged")],
    delivery: step(11, 15, 18, 22),
  }),
  ticket("e32", "SILO-32", "Route d'envoi des photos", {
    statusId: "in_review",
    externalRefs: [pr(22, "open")],
    delivery: step(10, 16, 15, 4),
  }),
  ticket("e33", "SILO-33", "Écran d'envoi hors ligne", {
    statusId: "in_progress",
    externalRefs: [{ kind: "git_branch", branch: "feat/envoi-hors-ligne", base: null }],
    delivery: step(7, 16, 14, 51),
    session: { tool: "T3 Code", startedAt: NOW - 42 * 60_000 },
  }),
  ticket("e34", "SILO-34", "Tests E2E de l'envoi", {
    openQuestions: 1,
    waitingOn: ["SILO-33"],
    startReason: { kind: "dependency", keys: ["SILO-33"] },
  }),
  ticket("e35", "SILO-35", "Démo client", {
    waitingOn: ["SILO-34"],
    startReason: { kind: "dependency", keys: ["SILO-34", "SILO-32", "SILO-33"] },
  }),
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

const F5 = ticket("f5", "SILO-30", "Envoyer les photos d'un constat", {
  parentId: null,
  statusId: "in_progress",
  shortKey: "F5",
  sprintId: "s42",
  description:
    "Dans un centre sans réseau, un chef de centre photographie un constat. Les photos partent seules au retour du réseau et apparaissent dans le dossier du client.",
  progress: { done: 1, total: 5 },
  feature: feature(STEPS, "f5", "2026-10-16", "2026-10-16"),
});

const F3_STEP = ticket("e21", "SILO-21", "Réaffecter", { parentId: "f3", statusId: "done" });
const F3 = ticket("f3", "SILO-20", "Réaffecter un box", {
  parentId: null,
  statusId: "done",
  shortKey: "F3",
  sprintId: "s42",
  progress: { done: 1, total: 1 },
  feature: feature([F3_STEP], "f3", "2026-10-16", "2026-10-16"),
});
const F7_STEP = ticket("e71", "SILO-71", "Rapport", { parentId: "f7", effectiveSprintId: "s44" });
const F7 = ticket("f7", "SILO-70", "Rapport de centre", {
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
  title: "Quota par client : 2 Go ou 5 Go ?",
  context: "",
  options: ["2 Go", "5 Go"],
  provisional: null,
  blocking: false,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: at(15, 10, 0),
  number: null,
  importRef: { kind: "import_ref", source: "plan", id: "Q16" },
  answer: null,
  recipient: "product",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
};

export function siloFeatureProject(): ProjectSnapshot {
  return {
    meta: {
      id: "silo",
      name: "Silo",
      key: "SILO",
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
    nextTicketKey: "SILO-94",
    sprints: SPRINTS,
    tickets: [F3, F3_STEP, F5, ...STEPS, F7, F7_STEP],
  };
}

export const MINIO = "Serveur MinIO de recette indisponible";
export const MERGE_RULE = "Règle de fusion à valider par le client";
const ownHold = (key: string, reason: string) => ({
  source: "own" as const,
  key,
  reason,
  since: "2026-10-16",
});
const HELD_PATCH: Record<string, Partial<TicketView>> = {
  e33: { hold: { reason: MINIO, since: "2026-10-16" }, onHold: ownHold("SILO-33", MINIO) },
  e34: { onHold: { ...ownHold("SILO-33", MINIO), source: "dependency" } },
  e35: { onHold: { ...ownHold("SILO-33", MINIO), source: "dependency" } },
};

const withHeldReason = (t: TicketView): TicketView => {
  const patched = { ...t, ...HELD_PATCH[t.id] };
  return patched.onHold === null || patched.statusId !== "todo"
    ? patched
    : { ...patched, startable: false, startReason: { kind: "onHold", hold: patched.onHold } };
};

const F4_STEPS: TicketView[] = [
  ticket("e41", "SILO-41", "Schéma local des constats", { parentId: "f4", statusId: "done" }),
  ticket("e42", "SILO-42", "Formulaire de saisie", { parentId: "f4", statusId: "done" }),
  ticket("e43", "SILO-43", "Synchro au retour du réseau", { parentId: "f4", statusId: "done" }),
  ticket("e45", "SILO-45", "Conflits de saisie", {
    parentId: "f4",
    statusId: "in_review",
    hold: { reason: MERGE_RULE, since: "2026-10-16" },
    onHold: ownHold("SILO-45", MERGE_RULE),
  }),
];

export function siloHeldProject(): ProjectSnapshot {
  const base = siloFeatureProject();
  const steps = base.tickets.filter((t) => t.parentId === "f5").map(withHeldReason);
  const f5 = base.tickets.find((t) => t.id === "f5");
  if (!f5) throw new Error("fixture without F5");
  const F4 = ticket("f4", "SILO-40", "Saisir un constat hors ligne", {
    parentId: null,
    statusId: "in_progress",
    shortKey: "F4",
    sprintId: "s42",
    progress: { done: 3, total: 4 },
    feature: feature(F4_STEPS, "f4", "2026-10-16", "2026-10-16"),
  });
  const others = base.tickets.filter((t) => t.parentId !== "f5" && t.id !== "f5");
  return {
    ...base,
    tickets: [
      F4,
      ...F4_STEPS,
      ...others,
      { ...f5, feature: feature(steps, "f5", "2026-10-16", "2026-10-16") },
      ...steps,
    ],
  };
}
