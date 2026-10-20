import type { Sprint, StatusId, Ticket } from "@kibo/schema";
import { createSeedTicket, type SeedRun } from "./graph-seed";

type FeatureSeed = { title: string; sprint: string | null; steps: StatusId[] };

export const SEED_TODAY = "2026-10-16";

const SPRINTS = [
  ["S41", "Accès", "2026-10-05", "2026-10-09"],
  ["S42", "Saisie hors ligne", "2026-10-12", "2026-10-16"],
  ["S43", "Import et contrats", "2026-10-19", "2026-10-23"],
  ["S44", "Rapports", "2026-10-26", "2026-10-30"],
] as const;

const FEATURES: readonly FeatureSeed[] = [
  { title: "Se connecter avec Microsoft", sprint: "S41", steps: ["done", "done", "done", "done"] },
  { title: "Voir ses box affectés", sprint: "S41", steps: ["done", "done", "done", "done", "done"] },
  { title: "Réaffecter un box", sprint: "S42", steps: ["done", "done", "done", "done"] },
  {
    title: "Saisir un constat hors ligne",
    sprint: "S42",
    steps: ["done", "done", "done", "in_review", "todo"],
  },
  {
    title: "Envoyer les photos d'un constat",
    sprint: "S42",
    steps: ["done", "in_review", "in_progress", "todo", "todo"],
  },
  { title: "Importer les box depuis Excel", sprint: "S43", steps: ["todo", "todo", "todo", "todo"] },
  { title: "Rapport de centre journalier", sprint: "S44", steps: ["todo", "todo", "todo", "todo", "todo"] },
  { title: "Valider les contrats par lot", sprint: "S43", steps: ["todo", "todo", "todo", "todo"] },
  { title: "Exporter le dossier client", sprint: null, steps: ["todo", "todo", "todo"] },
];

const FEATURE_LINKS: readonly [number, number][] = [
  [1, 2],
  [1, 3],
  [2, 4],
  [1, 5],
  [3, 7],
  [3, 6],
  [4, 6],
  [6, 8],
];

const create = (run: SeedRun, title: string, parentId: string | null, statusId: StatusId = "todo"): Ticket =>
  createSeedTicket(run, { title, parentId, statusId, assignee: { kind: "human", ref: "adam" } });

export function seedSprintGraph(run: SeedRun): void {
  const sprints = new Map<string, Sprint>(
    SPRINTS.map(([code, name, start, end]) => [
      code,
      run({ method: "createSprint", code, name, start, end }) as Sprint,
    ]),
  );
  const features = FEATURES.map((f) => {
    const root = create(run, f.title, null);
    const steps = f.steps.map((status, i) => create(run, `${f.title} · étape ${i + 1}`, root.id, status));
    const sprint = f.sprint === null ? undefined : sprints.get(f.sprint);
    if (sprint !== undefined) run({ method: "setTicketSprint", ticketId: root.id, sprintId: sprint.id });
    return { root, steps };
  });
  const f5 = features[4]?.steps ?? [];
  const stepLinks: [Ticket | undefined, Ticket | undefined][] = [
    [f5[2], f5[3]],
    [f5[3], f5[4]],
  ];
  for (const [from, to] of stepLinks)
    if (from && to) run({ method: "addLink", from: from.id, to: to.id, type: "blocks" });
  for (const [from, to] of FEATURE_LINKS) {
    const a = features[from]?.root;
    const b = features[to]?.root;
    if (a && b) run({ method: "addLink", from: a.id, to: b.id, type: "blocks" });
  }
}
