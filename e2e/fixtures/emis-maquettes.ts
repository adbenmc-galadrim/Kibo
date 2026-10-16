export type SprintCode = "S41" | "S42" | "S43" | "S44";
export type StepStatus = "todo" | "in_progress" | "in_review" | "done";
export type PrSpec = { number: number; state: "open" | "merged" };
export type StepSpec = {
  n: number;
  title: string;
  status: StepStatus;
  delivery?: number;
  pr?: PrSpec;
  branch?: string;
  mine?: boolean;
};
export type FeatureSpec = {
  shortKey: string;
  n: number;
  title: string;
  sprint: SprintCode | null;
  result?: string;
  steps: StepSpec[];
};
export type SprintSpec = { code: SprintCode; title: string; start: string; end: string };
export type LooseTicketSpec = StepSpec & { sprint: SprintCode };
export type QuestionSpec = {
  id: string;
  ticket: number;
  title: string;
  recipient: "client" | "product";
  blocking: boolean;
};
export type ProjectSpec = { name: string; key: string; color: string };

export const EMIS_WORKSPACE_NAME = "Galadrim";
export const EMIS_PROJECT: ProjectSpec = { name: "Emis", key: "EMIS", color: "#14B8A6" };
export const OTHER_PROJECTS: readonly ProjectSpec[] = [
  { name: "Kibo", key: "KIB", color: "#6366F1" },
  { name: "Gereco", key: "GER", color: "#84CC16" },
  { name: "Rapid", key: "RAP", color: "#EC4899" },
];
export const INBOX_TITLES: readonly string[] = [
  "Relire le compte rendu de la réunion client",
  "Idée : export CSV des soudures",
];
export const EMIS_REPO_URL = "https://github.com/galadrimteam/emis-suivi-chantier";
export const EMIS_BASE_BRANCH = "dev";
export const EMIS_LAST_TICKET = 93;
export const DELIVERED_STEP = 11;

export const EMIS_SPRINTS: readonly SprintSpec[] = [
  { code: "S41", title: "Accès", start: "2026-10-05", end: "2026-10-09" },
  { code: "S42", title: "Terrain hors ligne", start: "2026-10-12", end: "2026-10-16" },
  { code: "S43", title: "Import et soudures", start: "2026-10-19", end: "2026-10-23" },
  { code: "S44", title: "Rapports", start: "2026-10-26", end: "2026-10-30" },
];

const done = (n: number, title: string, pr?: PrSpec): StepSpec => ({
  n,
  title,
  status: "done",
  delivery: DELIVERED_STEP,
  ...(pr === undefined ? {} : { pr }),
});
const todo = (n: number, title: string, extra: Partial<StepSpec> = {}): StepSpec => ({
  n,
  title,
  status: "todo",
  ...extra,
});
const merged = (number: number): PrSpec => ({ number, state: "merged" });
const open = (number: number): PrSpec => ({ number, state: "open" });

export const EMIS_FEATURES: readonly FeatureSpec[] = [
  {
    shortKey: "F1",
    n: 1,
    title: "Se connecter avec Microsoft",
    sprint: "S41",
    steps: [
      done(2, "Application Azure"),
      done(3, "Route de connexion"),
      done(4, "Écran de connexion"),
      done(5, "Démo client"),
    ],
  },
  {
    shortKey: "F2",
    n: 9,
    title: "Voir ses ISO affectés",
    sprint: "S41",
    steps: [
      done(10, "Modèle des affectations"),
      done(11, "Périmètre côté serveur"),
      done(12, "Règles de synchro"),
      done(13, "Liste des ISO"),
      done(14, "Démo client"),
    ],
  },
  {
    shortKey: "F3",
    n: 17,
    title: "Réaffecter un ISO",
    sprint: "S42",
    steps: [
      done(18, "Historique des affectations"),
      done(19, "Route de réaffectation"),
      done(20, "Écran de réaffectation"),
      done(21, "Démo client", merged(18)),
    ],
  },
  {
    shortKey: "F4",
    n: 40,
    title: "Saisir un tronçon hors ligne",
    sprint: "S42",
    result:
      "Sans réseau, un chef de chantier saisit un tronçon ; la saisie remonte seule au retour du réseau.",
    steps: [
      done(41, "Schéma local des tronçons", merged(12)),
      done(42, "Formulaire de saisie", merged(14)),
      done(43, "Synchro au retour du réseau", merged(16)),
      { n: 45, title: "Conflits de saisie", status: "in_review", delivery: 9, pr: open(20), mine: true },
      todo(46, "Démo client", { mine: true }),
    ],
  },
  {
    shortKey: "F5",
    n: 30,
    title: "Envoyer les photos d'un tronçon",
    sprint: "S42",
    result:
      "Sur le terrain, sans réseau, un chef de chantier photographie un tronçon. Les photos partent seules au retour du réseau et apparaissent dans le dossier de l'affaire.",
    steps: [
      done(31, "Stockage des photos sur MinIO", merged(19)),
      {
        n: 32,
        title: "Route d'envoi des photos",
        status: "in_review",
        delivery: 10,
        pr: open(22),
        mine: true,
      },
      {
        n: 33,
        title: "Écran d'envoi hors ligne",
        status: "in_progress",
        delivery: 7,
        branch: "feat/envoi-hors-ligne",
        mine: true,
      },
      todo(34, "Tests E2E de l'envoi", { mine: true }),
      todo(35, "Démo client", { mine: true }),
    ],
  },
  {
    shortKey: "F6",
    n: 50,
    title: "Importer les ISO depuis Excel",
    sprint: "S43",
    steps: [
      todo(51, "Lecture du fichier Excel", { delivery: 3 }),
      todo(52, "Contrôle des repères"),
      todo(53, "Écran d'import"),
      todo(54, "Démo client"),
    ],
  },
  {
    shortKey: "F7",
    n: 80,
    title: "Rapport de chantier journalier",
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
    title: "Valider les soudures par lot",
    sprint: "S43",
    steps: [
      todo(71, "Statuts de soudure"),
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

export const EMIS_ROOT_ORDER: readonly number[] = [1, 9, 17, 40, 30, 50, 61, 70, 80, 90];

export const EMIS_LOOSE_TICKET: LooseTicketSpec = {
  n: 61,
  title: "Passage à Expo SDK 54",
  status: "in_review",
  pr: open(23),
  sprint: "S42",
};

export const EMIS_STEP_LINKS: readonly (readonly [number, number])[] = [
  [33, 34],
  [34, 35],
];

export const EMIS_FEATURE_LINKS: readonly (readonly [string, string])[] = [
  ["F2", "F3"],
  ["F2", "F4"],
  ["F3", "F5"],
  ["F2", "F6"],
  ["F4", "F8"],
  ["F4", "F7"],
  ["F5", "F7"],
  ["F7", "F9"],
];

export const EMIS_QUESTIONS: readonly QuestionSpec[] = [
  {
    id: "Q14",
    ticket: 51,
    title: "Un ISO réaffecté garde-t-il ses photos ?",
    recipient: "client",
    blocking: true,
  },
  {
    id: "Q16",
    ticket: 34,
    title: "Quota par affaire : 2 Go ou 5 Go ?",
    recipient: "product",
    blocking: false,
  },
  {
    id: "Q17",
    ticket: 81,
    title: "Un rapport par chef de chantier ou par affaire ?",
    recipient: "client",
    blocking: false,
  },
];

export const EMIS_PAGES: readonly (readonly [string, string])[] = [
  ["Planning", "planning@1.0.0"],
  ["Tickets", "tickets@1.0.0"],
  ["Kanban", "kanban@1.0.0"],
  ["Graphe", "graph@1.0.0"],
  ["Notes", "notes@1.0.0"],
  ["Questions", "questions@1.0.0"],
];

export const emisKey = (n: number): string => `${EMIS_PROJECT.key}-${n}`;
export const sprintName = (s: Pick<SprintSpec, "code" | "title">): string => `${s.code} ${s.title}`;
export const prUrl = (number: number): string => `${EMIS_REPO_URL}/pull/${number}`;

export const emisSteps = (): StepSpec[] => EMIS_FEATURES.flatMap((f) => f.steps);
export const emisUsedTickets = (): Set<number> =>
  new Set([...EMIS_FEATURES.flatMap((f) => [f.n, ...f.steps.map((s) => s.n)]), EMIS_LOOSE_TICKET.n]);
