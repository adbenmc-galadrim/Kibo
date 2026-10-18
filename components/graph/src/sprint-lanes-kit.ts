import {
  EMPTY_PROGRESS,
  featureState,
  featureSteps,
  type GithubPrRef,
  type Link,
  type PrReview,
  Question,
  type SprintView,
  type StatusId,
  sprintState,
  type TicketView,
} from "@kibo/schema";
import type { SprintLanesInput } from "./sprint-lanes";

export const KIT_TODAY = "2026-10-16";
export const KIT_DAY_AFTER = "2026-10-17";

type Pr = [number, "open" | "merged", PrReview?];
type Step = { n: number; title: string; status: StatusId; pr?: Pr; branch?: string; optional?: boolean };
type Feature = { shortKey: string; n: number; title: string; sprint: string | null; steps: Step[] };

const done = (n: number, title: string, pr?: number): Step => ({
  n,
  title,
  status: "done",
  ...(pr === undefined ? {} : { pr: [pr, "merged"] }),
});
const todo = (n: number, title: string, optional = false): Step => ({ n, title, status: "todo", optional });

const SPRINTS = [
  ["S41", "Accès", "2026-10-05", "2026-10-09"],
  ["S42", "Saisie hors ligne", "2026-10-12", "2026-10-16"],
  ["S43", "Import et contrats", "2026-10-19", "2026-10-23"],
  ["S44", "Rapports", "2026-10-26", "2026-10-30"],
] as const;

const FEATURES: readonly Feature[] = [
  {
    shortKey: "F1",
    n: 1,
    title: "Se connecter avec Microsoft",
    sprint: "S41",
    steps: [done(2, "Application Azure"), done(3, "Route"), done(4, "Écran"), done(5, "Démo client")],
  },
  {
    shortKey: "F2",
    n: 9,
    title: "Voir ses box affectés",
    sprint: "S41",
    steps: [10, 11, 12, 13, 14].map((n) => done(n, `Étape ${n}`)),
  },
  {
    shortKey: "F3",
    n: 17,
    title: "Réaffecter un box",
    sprint: "S42",
    steps: [done(18, "Historique"), done(19, "Route"), done(20, "Écran"), done(21, "Démo client", 18)],
  },
  {
    shortKey: "F4",
    n: 40,
    title: "Saisir un constat hors ligne",
    sprint: "S42",
    steps: [
      done(41, "Schéma local des constats", 12),
      done(42, "Formulaire de saisie", 14),
      done(43, "Synchro au retour du réseau", 16),
      { n: 45, title: "Conflits de saisie", status: "in_review", pr: [20, "open", "changes_requested"] },
      todo(46, "Démo client", true),
    ],
  },
  {
    shortKey: "F5",
    n: 30,
    title: "Envoyer les photos d'un constat",
    sprint: "S42",
    steps: [
      done(31, "Stockage des photos sur MinIO", 19),
      { n: 32, title: "Route d'envoi des photos", status: "in_review", pr: [22, "open"] },
      { n: 33, title: "Écran d'envoi hors ligne", status: "in_progress", branch: "feat/envoi-hors-ligne" },
      todo(34, "Tests E2E de l'envoi"),
      todo(35, "Démo client"),
    ],
  },
  {
    shortKey: "F6",
    n: 50,
    title: "Importer les box depuis Excel",
    sprint: "S43",
    steps: [
      todo(51, "Lecture du fichier Excel"),
      todo(52, "Contrôle des numéros"),
      todo(53, "Écran d'import"),
      todo(54, "Démo client"),
    ],
  },
  {
    shortKey: "F7",
    n: 80,
    title: "Rapport de centre journalier",
    sprint: "S44",
    steps: [
      todo(81, "Modèle du rapport"),
      todo(82, "Génération PDF"),
      todo(83, "Photos dans le rapport"),
      todo(84, "Envoi le soir"),
      todo(85, "Démo client"),
    ],
  },
  {
    shortKey: "F8",
    n: 70,
    title: "Valider les contrats par lot",
    sprint: "S43",
    steps: [
      todo(71, "Statuts de contrat"),
      todo(72, "Sélection multiple"),
      todo(73, "Validation par lot"),
      todo(74, "Démo client"),
    ],
  },
  {
    shortKey: "F9",
    n: 90,
    title: "Exporter le dossier client",
    sprint: null,
    steps: [todo(91, "Format du dossier"), todo(92, "Archive ZIP"), todo(93, "Démo client")],
  },
];

const STEP_LINKS: readonly [number, number][] = [
  [33, 34],
  [34, 35],
];
const FEATURE_LINKS: readonly [string, string][] = [
  ["F2", "F3"],
  ["F2", "F4"],
  ["F3", "F5"],
  ["F2", "F6"],
  ["F4", "F8"],
  ["F4", "F7"],
  ["F5", "F7"],
  ["F7", "F9"],
];
const SESSIONS = new Set(["SILO-33", "SILO-45"]);

const key = (n: number) => `SILO-${n}`;
const sprintIdOf = (code: string | null) => (code === null ? null : code.toLowerCase());

export function kitView(over: Partial<TicketView> & Pick<TicketView, "id" | "title">): TicketView {
  return {
    key: over.id,
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
    progress: { done: 0, total: 0 },
    waitingOn: [],
    keyLabel: over.id,
    openQuestions: 0,
    startable: false,
    startReason: null,
    effectiveSprintId: null,
    feature: null,
    session: null,
    updatedAt: null,
    ...over,
  };
}

const prRef = ([number, state, review = "none"]: Pr): GithubPrRef => ({
  kind: "github_pr",
  url: `https://github.com/silo-labs/silo-location/pull/${number}`,
  number,
  state,
  base: "dev",
  head: null,
  review,
  checks: null,
});

const stepView = (s: Step, f: Feature): TicketView =>
  kitView({
    id: key(s.n),
    title: s.title,
    statusId: s.status,
    parentId: key(f.n),
    optional: s.optional ?? false,
    effectiveSprintId: sprintIdOf(f.sprint),
    session: SESSIONS.has(key(s.n)) ? { tool: "T3 Code", startedAt: 1 } : null,
    externalRefs: [
      ...(s.branch === undefined ? [] : [{ kind: "git_branch" as const, branch: s.branch, base: null }]),
      ...(s.pr === undefined ? [] : [prRef(s.pr)]),
    ],
  });

export const KIT_SPRINTS: SprintView[] = SPRINTS.map(([code, name, start, end]) => {
  const own = FEATURES.filter((f) => f.sprint === code);
  return {
    id: code.toLowerCase(),
    code,
    name,
    start,
    end,
    state: sprintState({ start, end }, KIT_TODAY),
    features: own.map((f) => key(f.n)),
    delivered: 0,
    total: own.length,
    lingering: false,
  };
});

export const KIT_QUESTIONS: Question[] = [
  Question.parse({
    id: "q-14",
    ticketId: key(51),
    runId: null,
    title: "Un box réaffecté garde-t-il ses photos ?",
    context: "",
    options: [],
    provisional: null,
    blocking: true,
    createdBy: { kind: "import", ref: "silo" },
    createdAt: 1,
    importRef: { kind: "import_ref", source: "silo", id: "Q14" },
    answer: null,
  }),
];

const rootOf = (shortKey: string) => key(FEATURES.find((f) => f.shortKey === shortKey)?.n ?? 0);

export const KIT_LINKS: Link[] = [
  ...STEP_LINKS.map(([from, to]) => [key(from), key(to)] as const),
  ...FEATURE_LINKS.map(([from, to]) => [rootOf(from), rootOf(to)] as const),
].map(([from, to], i) => ({ id: `l${i}`, from, to, type: "blocks" as const }));

export function kitTickets(today: string = KIT_TODAY): TicketView[] {
  const rows = FEATURES.flatMap((f) => [
    kitView({
      id: key(f.n),
      title: f.title,
      shortKey: f.shortKey,
      sprintId: sprintIdOf(f.sprint),
      effectiveSprintId: sprintIdOf(f.sprint),
      progress: { done: f.steps.filter((s) => s.status === "done").length, total: f.steps.length },
    }),
    ...f.steps.map((s) => stepView(s, f)),
  ]);
  const tickets = [...rows, kitView({ id: key(61), title: "Passage à Expo SDK 54", sprintId: "s42" })];
  const sprints = new Map(KIT_SPRINTS.map((s) => [s.id, s]));
  return tickets.map((t) =>
    t.parentId !== null || t.progress.total === 0
      ? t
      : {
          ...t,
          feature: featureState({
            steps: featureSteps({ feature: t.id, tickets, links: KIT_LINKS }),
            blockingQuestions: new Set([key(51)]),
            sprint: t.sprintId === null ? null : (sprints.get(t.sprintId) ?? null),
            today,
          }),
        },
  );
}

export const kitInput = (over: Partial<SprintLanesInput> = {}): SprintLanesInput => ({
  tickets: kitTickets(),
  links: KIT_LINKS,
  sprints: KIT_SPRINTS,
  questions: KIT_QUESTIONS,
  live: new Set(),
  collapseDelivered: true,
  today: KIT_TODAY,
  ...over,
});
