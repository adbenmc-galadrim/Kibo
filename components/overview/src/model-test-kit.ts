import { DEFAULT_RECIPIENTS, type ProjectEvent, type TicketView } from "@kibo/schema";
import { createMockSdk } from "@kibo/sdk/mock";
import { manifest } from "./index";
import { type OverviewInput, overviewModel } from "./overview-model";
import { NOW, seedOverview, TODAY } from "./test-seed";

const at = (time: string) => Date.parse(`${TODAY}T${time}:00`);
const MINUTE = 60_000;
const DAY = 86_400_000;

export function build(today: string = TODAY) {
  let seeded: ReturnType<typeof seedOverview> | undefined;
  const m = createMockSdk(manifest, {
    today,
    seed: (run) => {
      seeded = seedOverview(run);
    },
  });
  if (!seeded) throw new Error("seed missing");
  const s = m.snapshot();
  const byTitle = (title: string): TicketView => {
    const found = s.tickets.find((t) => t.title === title);
    if (!found) throw new Error(title);
    return found;
  };
  const sessions = new Map([
    [byTitle("Écran d'envoi hors ligne").id, NOW - 42 * MINUTE],
    [byTitle("Conflits de saisie").id, NOW - 18 * MINUTE],
  ]);
  const tickets = s.tickets.map((t) => {
    const startedAt = sessions.get(t.id);
    return startedAt === undefined ? t : { ...t, session: { tool: "T3 Code", startedAt } };
  });
  const ages = [NOW - 3 * DAY, NOW - DAY - 3_600_000, NOW - 2 * 3_600_000];
  const questions = s.questions.map((q, i) => ({ ...q, createdAt: ages[i] ?? NOW }));
  const f3 = byTitle("Réaffecter un box");
  const event = (
    id: number,
    time: string,
    kind: ProjectEvent["kind"],
    ticket: TicketView,
    feature: TicketView | null,
    source: ProjectEvent["source"],
    data: ProjectEvent["data"],
  ): ProjectEvent => ({
    id,
    projectId: "mock",
    at: at(time),
    kind,
    ticketId: ticket.id,
    featureId: feature?.id ?? null,
    source,
    data,
  });
  const f5 = byTitle("Envoyer les photos d'un constat");
  const events: ProjectEvent[] = [
    event(1, "13:10", "pr_checks", byTitle("Passage à Expo SDK 54"), null, "git", {
      number: 23,
      checks: "running",
    }),
    event(2, "13:30", "pr_review", byTitle("Conflits de saisie"), null, "git", {
      number: 20,
      review: "changes_requested",
    }),
    event(3, "14:36", "pr_merged", byTitle("Démo client"), f3, "git", { number: 18, delivered: "F3" }),
    { ...event(4, "14:40", "batch_proposed", f5, null, "project-agent", { seq: 7 }), ticketId: null },
    event(5, "14:51", "step_set", byTitle("Écran d'envoi hors ligne"), f5, "full-delivery", { step: 7 }),
    event(6, "15:04", "pr_opened", byTitle("Route d'envoi des photos"), f5, "git", { number: 22 }),
  ];
  const input: OverviewInput = {
    tickets,
    links: s.links,
    sprints: s.sprints,
    questions,
    events,
    ciRuns: [],
    recipients: DEFAULT_RECIPIENTS,
    workflow: s.workflow,
    tracking: null,
    today,
    now: NOW,
  };
  return { input, model: overviewModel(input), byTitle, seeded };
}
