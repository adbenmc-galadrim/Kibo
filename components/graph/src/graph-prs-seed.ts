import type { GithubPrRef, StatusId, Ticket } from "@kibo/schema";
import { createSeedTicket, type SeedRun } from "./graph-seed";

type Pr = Pick<GithubPrRef, "number" | "state" | "review" | "checks" | "base" | "head">;
type StepSeed = { title: string; status: StatusId; pr?: Pr };
type FeatureSeed = { shortKey: string; title: string; steps: StepSeed[] };

export const PRS_SEED_COUNTER = "5 PR ouvertes · 3 piles · 2 en attente de review · 1 à corriger";
export const PRS_SEED_SESSIONS = ["Écran d'envoi hors ligne", "Conflits de saisie"] as const;

export const seedPrUrl = (number: number): string =>
  `https://github.com/silo-labs/silo-location/pull/${number}`;

const pr = (number: number, over: Partial<Pr> = {}): Pr => ({
  number,
  state: "open",
  review: "none",
  checks: null,
  base: "dev",
  head: null,
  ...over,
});

const FEATURES: readonly FeatureSeed[] = [
  {
    shortKey: "F4",
    title: "Saisir un constat hors ligne",
    steps: [
      { title: "Synchro au retour du réseau", status: "done", pr: pr(16, { state: "merged" }) },
      {
        title: "Conflits de saisie",
        status: "in_review",
        pr: pr(20, { review: "changes_requested", checks: "error", head: "feat/silo-45" }),
      },
      { title: "Démo client", status: "todo" },
    ],
  },
  {
    shortKey: "F5",
    title: "Envoyer les photos d'un constat",
    steps: [
      { title: "Stockage des photos sur MinIO", status: "done", pr: pr(19, { state: "merged" }) },
      {
        title: "Route d'envoi des photos",
        status: "in_review",
        pr: pr(22, { checks: "ok", head: "feat/silo-32" }),
      },
      {
        title: "Écran d'envoi hors ligne",
        status: "in_progress",
        pr: pr(24, {
          state: "draft",
          checks: "running",
          base: "feat/silo-32",
          head: "feat/envoi-hors-ligne",
        }),
      },
      {
        title: "Tests E2E de l'envoi",
        status: "in_progress",
        pr: pr(25, { state: "draft", checks: "ok", base: "feat/envoi-hors-ligne", head: "feat/silo-34" }),
      },
      { title: "Démo client", status: "todo" },
    ],
  },
];

const FREE: StepSeed = {
  title: "Passage à Expo SDK 54",
  status: "in_review",
  pr: pr(23, { checks: "running", head: "chore/expo-54" }),
};

function createStep(run: SeedRun, step: StepSeed, parentId: string | null): Ticket {
  const ticket = createSeedTicket(run, { title: step.title, parentId, statusId: step.status });
  if (step.pr !== undefined)
    run({
      method: "upsertExternalRef",
      ticketId: ticket.id,
      ref: { kind: "github_pr", url: seedPrUrl(step.pr.number), ...step.pr },
    });
  return ticket;
}

export function seedPrGraph(run: SeedRun): void {
  for (const f of FEATURES) {
    const root = createSeedTicket(run, { title: f.title });
    for (const s of f.steps) createStep(run, s, root.id);
    run({ method: "updateTicket", ticketId: root.id, shortKey: f.shortKey });
  }
  createStep(run, FREE, null);
}
