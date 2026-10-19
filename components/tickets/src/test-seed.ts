import type { ExternalRef, ProjectCommand, Sprint, StatusId, Ticket } from "@kibo/schema";

export const TODAY = "2026-10-16";
export const MINUTE = 60_000;

type Step = {
  title: string;
  status?: StatusId;
  delivery?: { step: number; ago: number };
  refs?: ExternalRef[];
};

const pr = (number: number, state: "open" | "draft" | "merged" | "closed"): ExternalRef => ({
  kind: "github_pr",
  url: `https://github.com/silo-labs/silo-location/pull/${number}`,
  number,
  state,
  base: "main",
  head: `feat/pr-${number}`,
  review: "none",
  checks: null,
});

const branch = (name: string): ExternalRef => ({ kind: "git_branch", branch: name, base: null });

export function trackingSeed(now: number) {
  return (run: (cmd: ProjectCommand) => unknown) => {
    const sprint = (code: string, name: string, start: string, end: string) =>
      run({ method: "createSprint", code, name, start, end }) as Sprint;
    sprint("S41", "Accès", "2026-10-05", "2026-10-09");
    const s42 = sprint("S42", "Saisie hors ligne", "2026-10-12", TODAY);
    const s43 = sprint("S43", "Import et contrats", "2026-10-19", "2026-10-23");
    const ticket = (title: string, parentId: string | null, s: Step = { title }) => {
      const t = run({ method: "createTicket", title, parentId, statusId: s.status ?? "todo" }) as Ticket;
      for (const ref of s.refs ?? []) run({ method: "upsertExternalRef", ticketId: t.id, ref });
      if (s.delivery)
        run({
          method: "setTicketDelivery",
          ticketId: t.id,
          delivery: {
            step: s.delivery.step,
            note: "",
            at: now - s.delivery.ago,
            runId: null,
            kind: "delivery",
          },
        });
      return t;
    };
    const feature = (title: string, sprintId: string | null, steps: Step[]) => {
      const root = ticket(title, null);
      if (sprintId) run({ method: "setTicketSprint", ticketId: root.id, sprintId });
      return steps.map((s) => ticket(s.title, root.id, s));
    };
    const day = 24 * 60 * MINUTE;
    feature("Réaffecter un box", s42.id, [
      { title: "Liste des box", status: "done" },
      { title: "Choix du soudeur", status: "done" },
      { title: "Historique", status: "done" },
      {
        title: "Démo client",
        status: "done",
        delivery: { step: 11, ago: 120 * MINUTE },
        refs: [pr(18, "merged")],
      },
    ]);
    feature("Saisir un constat hors ligne", s42.id, [
      {
        title: "Formulaire de saisie",
        status: "done",
        delivery: { step: 11, ago: 3 * day },
        refs: [pr(14, "merged")],
      },
      { title: "Synchro au retour du réseau", status: "done", delivery: { step: 11, ago: 2 * day } },
      {
        title: "Conflits de saisie",
        status: "in_review",
        delivery: { step: 9, ago: 18 * MINUTE },
        refs: [pr(20, "open")],
      },
      { title: "Démo client" },
    ]);
    const [, , ecran, tests] = feature("Envoyer les photos d'un constat", s42.id, [
      {
        title: "Stockage des photos sur MinIO",
        status: "done",
        delivery: { step: 11, ago: day },
        refs: [pr(19, "merged")],
      },
      {
        title: "Route d'envoi des photos",
        status: "in_review",
        delivery: { step: 10, ago: 60 * MINUTE },
        refs: [pr(22, "open")],
      },
      {
        title: "Écran d'envoi hors ligne",
        status: "in_progress",
        delivery: { step: 7, ago: 9 * MINUTE },
        refs: [branch("feat/envoi-hors-ligne")],
      },
      { title: "Tests E2E de l'envoi" },
    ]);
    if (ecran && tests) run({ method: "addLink", from: ecran.id, to: tests.id, type: "blocks" });
    const loose = ticket("Mettre à jour la doc", null);
    run({ method: "setTicketSprint", ticketId: loose.id, sprintId: s42.id });
    feature("Importer les box depuis Excel", s43.id, [{ title: "Lecture du fichier" }]);
    feature("Exporter le dossier client", null, [{ title: "Gabarit PDF" }]);
  };
}
