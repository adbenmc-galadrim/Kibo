import type { ProjectCommand, Sprint, StatusId, Ticket } from "@kibo/schema";

type Run = (cmd: ProjectCommand) => unknown;
type StepSeed = { status: StatusId; optional?: boolean; delivery?: { step: number; at: number } };
type Seeded = { root: Ticket; steps: Ticket[] };

const sprint = (run: Run, code: string, name: string, start: string, end: string): Sprint =>
  run({ method: "createSprint", code, name, start, end }) as Sprint;

const ticket = (run: Run, title: string, parentId: string | null, statusId: StatusId = "todo"): Ticket =>
  run({ method: "createTicket", title, parentId, statusId }) as Ticket;

function feature(run: Run, title: string, sprintId: string | null, seeds: StepSeed[]): Seeded {
  const root = ticket(run, title, null);
  const steps = seeds.map((s, i) => {
    const step = ticket(run, `${title} · étape ${i + 1}`, root.id, s.status);
    if (s.optional) run({ method: "setTicketOptional", ticketId: step.id, optional: true });
    if (s.delivery)
      run({
        method: "setTicketDelivery",
        ticketId: step.id,
        delivery: { ...s.delivery, note: "", runId: null },
      });
    return step;
  });
  if (sprintId !== null) run({ method: "setTicketSprint", ticketId: root.id, sprintId });
  return { root, steps };
}

const repeat = (status: StatusId, n: number): StepSeed[] => Array.from({ length: n }, () => ({ status }));

export const TODAY = "2026-10-16";

export function seedPlanning(run: Run) {
  const s41 = sprint(run, "S41", "Accès", "2026-10-05", "2026-10-09");
  const s42 = sprint(run, "S42", "Terrain hors ligne", "2026-10-12", "2026-10-16");
  const s43 = sprint(run, "S43", "Import et soudures", "2026-10-19", "2026-10-23");
  const s44 = sprint(run, "S44", "Rapports", "2026-10-26", "2026-10-30");
  const f1 = feature(run, "Se connecter avec Microsoft", s41.id, repeat("done", 2));
  const f2 = feature(run, "Voir ses ISO affectés", s41.id, repeat("done", 2));
  const f3 = feature(run, "Réaffecter un ISO", s42.id, repeat("done", 4));
  const f4 = feature(run, "Saisir un tronçon hors ligne", s42.id, [
    ...repeat("done", 3),
    { status: "in_review", delivery: { step: 9, at: 2000 } },
    { status: "todo", optional: true },
  ]);
  const f5 = feature(run, "Envoyer les photos d'un tronçon", s42.id, [
    { status: "done" },
    { status: "in_review", delivery: { step: 10, at: 1000 } },
    { status: "in_progress", delivery: { step: 7, at: 3000 } },
    { status: "todo" },
    { status: "todo" },
  ]);
  const f6 = feature(run, "Importer les ISO depuis Excel", s43.id, [
    { status: "todo", delivery: { step: 3, at: 4000 } },
    ...repeat("todo", 3),
  ]);
  const f7 = feature(run, "Rapport de chantier journalier", s44.id, repeat("todo", 5));
  const f8 = feature(run, "Valider les soudures par lot", s43.id, repeat("todo", 4));
  const f9 = feature(run, "Exporter le dossier client", null, repeat("todo", 3));
  const lone = ticket(run, "Corriger l'export PDF", null);
  const [blockedStep] = f6.steps;
  if (blockedStep)
    run({
      method: "createQuestion",
      ticketId: blockedStep.id,
      title: "Quel format pour l'import Excel ?",
      blocking: true,
      createdBy: { kind: "human", ref: "adam" },
      importRef: { kind: "import_ref", source: "plan", id: "Q14" },
    });
  return { sprints: { s41, s42, s43, s44 }, features: { f1, f2, f3, f4, f5, f6, f7, f8, f9 }, lone };
}

export const seed = (run: Run) => {
  seedPlanning(run);
};
