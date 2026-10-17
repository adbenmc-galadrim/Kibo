import type { GithubPrRef, ProjectCommand, Sprint, StatusId, Ticket } from "@kibo/schema";

type Run = (cmd: ProjectCommand) => unknown;
type Pr = Pick<GithubPrRef, "number" | "state" | "review" | "checks">;
type StepSeed = { title: string; status: StatusId; step?: number; optional?: boolean; pr?: Pr };
type FeatureSeed = { title: string; sprint: string | null; steps: StepSeed[] };

export const TODAY = "2026-10-16";
export const NOW = Date.parse(`${TODAY}T14:52:00`);
const REPO = "https://github.com/galadrimteam/emis-suivi-chantier";

const merged = (number: number): Pr => ({ number, state: "merged", review: "none", checks: null });
const done = (title: string, pr?: Pr): StepSeed => ({ title, status: "done", step: 11, pr });
const todo = (title: string, extra: Partial<StepSeed> = {}): StepSeed => ({
  title,
  status: "todo",
  ...extra,
});

const FEATURES: readonly FeatureSeed[] = [
  {
    title: "Se connecter avec Microsoft",
    sprint: "S41",
    steps: [done("Application Azure"), done("Démo client")],
  },
  { title: "Voir ses ISO affectés", sprint: "S41", steps: [done("Liste des ISO"), done("Démo client")] },
  {
    title: "Réaffecter un ISO",
    sprint: "S42",
    steps: [done("Historique"), done("Route"), done("Écran"), done("Démo client", merged(18))],
  },
  {
    title: "Saisir un tronçon hors ligne",
    sprint: "S42",
    steps: [
      done("Schéma local des tronçons", merged(12)),
      done("Formulaire de saisie", merged(14)),
      done("Synchro au retour du réseau", merged(16)),
      {
        title: "Conflits de saisie",
        status: "in_review",
        step: 9,
        pr: { number: 20, state: "open", review: "changes_requested", checks: "error" },
      },
      todo("Démo client", { optional: true }),
    ],
  },
  {
    title: "Envoyer les photos d'un tronçon",
    sprint: "S42",
    steps: [
      done("Stockage des photos sur MinIO", merged(19)),
      {
        title: "Route d'envoi des photos",
        status: "in_review",
        step: 10,
        pr: { number: 22, state: "open", review: "none", checks: "ok" },
      },
      { title: "Écran d'envoi hors ligne", status: "in_progress", step: 7 },
      todo("Tests E2E de l'envoi"),
      todo("Démo client"),
    ],
  },
  {
    title: "Importer les ISO depuis Excel",
    sprint: "S43",
    steps: [
      todo("Lecture du fichier Excel", { step: 3 }),
      todo("Contrôle"),
      todo("Écran"),
      todo("Démo client"),
    ],
  },
  {
    title: "Rapport de chantier journalier",
    sprint: "S44",
    steps: [todo("Modèle du rapport"), todo("PDF"), todo("Photos"), todo("Envoi"), todo("Démo client")],
  },
  {
    title: "Valider les soudures par lot",
    sprint: "S43",
    steps: [todo("Statuts"), todo("Sélection"), todo("Validation"), todo("Démo client")],
  },
  {
    title: "Exporter le dossier client",
    sprint: null,
    steps: [todo("Format"), todo("Archive"), todo("Démo")],
  },
];

const sprint = (run: Run, code: string, name: string, start: string, end: string): Sprint =>
  run({ method: "createSprint", code, name, start, end }) as Sprint;
const ticket = (run: Run, title: string, parentId: string | null, statusId: StatusId = "todo"): Ticket =>
  run({ method: "createTicket", title, parentId, statusId }) as Ticket;

function attachPr(run: Run, ticketId: string, pr: Pr) {
  run({
    method: "upsertExternalRef",
    ticketId,
    ref: { kind: "github_pr", url: `${REPO}/pull/${pr.number}`, base: "dev", head: null, ...pr },
  });
}

function stepTicket(run: Run, seed: StepSeed, parentId: string): Ticket {
  const step = ticket(run, seed.title, parentId, seed.status);
  if (seed.optional) run({ method: "setTicketOptional", ticketId: step.id, optional: true });
  if (seed.step !== undefined)
    run({
      method: "setTicketDelivery",
      ticketId: step.id,
      delivery: { step: seed.step, at: 1000, note: "", runId: null, kind: "delivery" },
    });
  if (seed.pr) attachPr(run, step.id, seed.pr);
  return step;
}

function question(
  run: Run,
  ticketId: string,
  title: string,
  ref: string,
  recipient: string,
  blocking: boolean,
) {
  run({
    method: "createQuestion",
    ticketId,
    title,
    blocking,
    recipient,
    createdBy: { kind: "human", ref: "adam" },
    importRef: { kind: "import_ref", source: "plan", id: ref },
  });
}

export function seedOverview(run: Run) {
  const sprints = new Map(
    [
      sprint(run, "S41", "Accès", "2026-10-05", "2026-10-09"),
      sprint(run, "S42", "Terrain hors ligne", "2026-10-12", "2026-10-16"),
      sprint(run, "S43", "Import et soudures", "2026-10-19", "2026-10-23"),
      sprint(run, "S44", "Rapports", "2026-10-26", "2026-10-30"),
    ].map((s) => [s.code, s]),
  );
  const features = FEATURES.map((f) => {
    const root = ticket(run, f.title, null);
    const steps = f.steps.map((s) => stepTicket(run, s, root.id));
    const sprintId = f.sprint === null ? null : (sprints.get(f.sprint)?.id ?? null);
    if (sprintId !== null) run({ method: "setTicketSprint", ticketId: root.id, sprintId });
    return { root, steps };
  });
  const loose = ticket(run, "Passage à Expo SDK 54", null, "in_review");
  attachPr(run, loose.id, { number: 23, state: "open", review: "none", checks: "running" });
  const [, , , f4, f5, f6, f7] = features;
  const [s31, , s33, s34, s35] = f5?.steps ?? [];
  if (s33 && s34) run({ method: "addLink", from: s33.id, to: s34.id, type: "blocks" });
  if (s34 && s35) run({ method: "addLink", from: s34.id, to: s35.id, type: "blocks" });
  const lecture = f6?.steps[0];
  const modele = f7?.steps[0];
  if (lecture) question(run, lecture.id, "Un ISO réaffecté garde-t-il ses photos ?", "Q14", "client", true);
  if (s34) question(run, s34.id, "Quota par affaire : 2 Go ou 5 Go ?", "Q16", "product", false);
  if (modele)
    question(run, modele.id, "Un rapport par chef de chantier ou par affaire ?", "Q17", "client", false);
  return { sprints, features, loose, f4, f5, s31 };
}

export const seed = (run: Run) => {
  seedOverview(run);
};

export const seedCrowded = (run: Run) => {
  const { loose } = seedOverview(run);
  for (let n = 1; n <= 7; n += 1) {
    const root = ticket(run, `Fonctionnalité en plus ${n}`, null);
    ticket(run, `Étape en plus ${n}`, root.id);
  }
  for (let n = 1; n <= 9; n += 1)
    question(run, loose.id, `Question en plus ${n}`, `Q${30 + n}`, "client", false);
};
