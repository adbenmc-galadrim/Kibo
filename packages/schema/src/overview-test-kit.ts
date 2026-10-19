import type { GithubPrRef, PrReview } from "./external-ref";
import { featureState } from "./feature-state";
import { featureSteps } from "./feature-steps";
import { EMPTY_PROGRESS } from "./progress";
import type { ProjectMeta } from "./project";
import { Question } from "./question";
import type { TicketView } from "./rpc";
import { type SprintView, sprintState } from "./sprint";
import type { StatusId } from "./status";

export const TODAY = "2026-10-16";
const REPO = "https://github.com/silo-labs/silo-location";

type Step = { n: number; status: StatusId; pr?: [number, "open" | "merged", PrReview?]; optional?: boolean };
type Feature = { shortKey: string; n: number; title: string; sprint: string | null; steps: Step[] };

const done = (n: number, pr?: number): Step => ({ n, status: "done", ...(pr ? { pr: [pr, "merged"] } : {}) });
const todo = (n: number, optional = false): Step => ({ n, status: "todo", optional });

const SPRINTS = [
  ["S41", "Accès", "2026-10-05", "2026-10-09"],
  ["S42", "Saisie hors ligne", "2026-10-12", "2026-10-16"],
  ["S43", "Import et contrats", "2026-10-19", "2026-10-23"],
  ["S44", "Rapports", "2026-10-26", "2026-10-30"],
] as const;

export const FEATURES: readonly Feature[] = [
  { shortKey: "F1", n: 1, title: "Se connecter avec Microsoft", sprint: "S41", steps: [done(2), done(3)] },
  { shortKey: "F2", n: 9, title: "Voir ses box affectés", sprint: "S41", steps: [done(10), done(11)] },
  { shortKey: "F3", n: 17, title: "Réaffecter un box", sprint: "S42", steps: [done(18), done(21, 18)] },
  {
    shortKey: "F4",
    n: 40,
    title: "Saisir un constat hors ligne",
    sprint: "S42",
    steps: [
      done(41, 12),
      done(42, 14),
      done(43, 16),
      { n: 45, status: "in_review", pr: [20, "open", "changes_requested"] },
      todo(46, true),
    ],
  },
  {
    shortKey: "F5",
    n: 30,
    title: "Envoyer les photos d'un constat",
    sprint: "S42",
    steps: [
      done(31, 19),
      { n: 32, status: "in_review", pr: [22, "open"] },
      { n: 33, status: "in_progress" },
      todo(34),
      todo(35),
    ],
  },
  {
    shortKey: "F6",
    n: 50,
    title: "Importer les box depuis Excel",
    sprint: "S43",
    steps: [todo(51), todo(52), todo(53), todo(54)],
  },
  {
    shortKey: "F8",
    n: 70,
    title: "Valider les contrats par lot",
    sprint: "S43",
    steps: [todo(71), todo(72), todo(73), todo(74)],
  },
  {
    shortKey: "F7",
    n: 80,
    title: "Rapport de centre journalier",
    sprint: "S44",
    steps: [todo(81), todo(82), todo(83), todo(84), todo(85)],
  },
  { shortKey: "F9", n: 90, title: "Exporter le dossier client", sprint: null, steps: [todo(91), todo(92)] },
];

const key = (n: number) => `SILO-${n}`;
const sprintId = (code: string | null) => (code === null ? null : code.toLowerCase());

export function viewOf(over: Partial<TicketView> & Pick<TicketView, "id" | "title">): TicketView {
  return {
    key: over.id.toUpperCase(),
    pendingSeq: null,
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
    progress: { done: 0, total: 0 },
    waitingOn: [],
    keyLabel: over.id.toUpperCase(),
    openQuestions: 0,
    startable: false,
    startReason: null,
    effectiveSprintId: null,
    feature: null,
    session: null,
    updatedAt: null,
    onHold: null,
    ...over,
  };
}

const prRef = (number: number, state: "open" | "merged", review: PrReview = "none"): GithubPrRef => ({
  kind: "github_pr",
  url: `${REPO}/pull/${number}`,
  number,
  state,
  base: "dev",
  head: null,
  review,
  checks: null,
});

function stepView(step: Step, feature: Feature): TicketView {
  const pr = step.pr;
  return viewOf({
    id: key(step.n),
    title: `Étape ${step.n}`,
    statusId: step.status,
    parentId: key(feature.n),
    optional: step.optional ?? false,
    effectiveSprintId: sprintId(feature.sprint),
    externalRefs: pr ? [prRef(pr[0], pr[1], pr[2])] : [],
  });
}

export const SPRINT_VIEWS: SprintView[] = SPRINTS.map(([code, name, start, end]) => {
  const features = FEATURES.filter((f) => f.sprint === code);
  return {
    id: code.toLowerCase(),
    code,
    name,
    start,
    end,
    state: sprintState({ start, end }, TODAY),
    features: features.map((f) => key(f.n)),
    delivered: features.filter((f) => f.steps.every((s) => s.status === "done" || s.optional)).length,
    total: features.length,
    lingering: false,
  };
});

export const BLOCKING: ReadonlyMap<string, string> = new Map([["SILO-51", "Q14"]]);

export function siloTickets(today: string = TODAY): TicketView[] {
  const rows = FEATURES.flatMap((f) => [
    viewOf({
      id: key(f.n),
      title: f.title,
      shortKey: f.shortKey,
      sprintId: sprintId(f.sprint),
      effectiveSprintId: sprintId(f.sprint),
      progress: { done: f.steps.filter((s) => s.status === "done").length, total: f.steps.length },
    }),
    ...f.steps.map((s) => stepView(s, f)),
  ]);
  const loose = viewOf({
    id: key(61),
    title: "Passage à Expo SDK 54",
    statusId: "in_review",
    sprintId: "s42",
    effectiveSprintId: "s42",
    externalRefs: [prRef(23, "open")],
  });
  const tickets = [...rows, loose];
  const sprints = new Map(SPRINT_VIEWS.map((s) => [s.id, s]));
  return tickets.map((t) =>
    t.parentId !== null || t.progress.total === 0
      ? t
      : {
          ...t,
          feature: featureState({
            steps: featureSteps({ feature: t.id, tickets, links: [] }),
            blockingQuestions: new Set(BLOCKING.keys()),
            sprint: t.sprintId === null ? null : (sprints.get(t.sprintId) ?? null),
            today,
          }),
        },
  );
}

const question = (id: string, ticketId: string, blocking: boolean, createdAt: number): Question =>
  Question.parse({
    id: `q-${id}`,
    ticketId,
    runId: null,
    title: `Question ${id}`,
    context: "",
    options: [],
    provisional: null,
    blocking,
    createdBy: { kind: "import", ref: "silo" },
    createdAt,
    importRef: { kind: "import_ref", source: "silo", id },
    answer: null,
  });

export const QUESTIONS: Question[] = [
  question("Q14", "SILO-51", true, 1),
  question("Q16", "SILO-34", false, 2),
  question("Q17", "SILO-81", false, 3),
];

export const META: ProjectMeta = {
  id: "silo",
  key: "SILO",
  name: "Silo",
  folder: null,
  color: "#14B8A6",
  worktree: null,
  storybook: null,
  duplication: null,
  delivery: null,
  tracking: null,
  description: "Location de box",
  client: null,
};

export const siloSnapshot = () => ({
  tickets: siloTickets(),
  sprints: SPRINT_VIEWS,
  questions: QUESTIONS,
  meta: META,
});
