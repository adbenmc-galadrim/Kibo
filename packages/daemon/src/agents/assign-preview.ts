import { initRun } from "@kibo/core/run-machine";
import { orderQueue, type Plan, tailRank } from "@kibo/core/scheduler";
import {
  type AgentProfile,
  type AssignPreview,
  isTerminal,
  type RunView,
  type TicketView,
} from "@kibo/schema";

const PREVIEW_ID = "preview";

export type PreviewInput = {
  runs: RunView[];
  projectId: string;
  ticket: TicketView & { key: string };
  profile: AgentProfile;
  guidelines: number;
  at: number;
  plan: (runs: RunView[]) => Plan;
};

export const activeRunOf = (runs: readonly RunView[], ticketId: string): RunView | null =>
  runs.find((r) => r.ticketId === ticketId && !isTerminal(r.state)) ?? null;

export function previewAssign(input: PreviewInput): AssignPreview {
  const { runs, ticket, profile, guidelines, at } = input;
  if (activeRunOf(runs, ticket.id)) return { position: null, reason: { kind: "ticket_busy" }, guidelines };
  const candidate = initRun(
    {
      id: PREVIEW_ID,
      seq: Number.MAX_SAFE_INTEGER,
      projectId: input.projectId,
      ticketId: ticket.id,
      ticketKey: ticket.key,
      ticketTitle: ticket.title,
      profileId: profile.id,
      profileName: profile.name,
      sessionId: PREVIEW_ID,
      brief: "",
      createdAt: at,
    },
    tailRank(runs),
    at,
  );
  const withCandidate = [...runs, candidate];
  const next = input.plan(withCandidate);
  if (next.admit.some((a) => a.runId === PREVIEW_ID)) return { position: null, reason: null, guidelines };
  const position = orderQueue(withCandidate).findIndex((r) => r.id === PREVIEW_ID) + 1;
  const reason = next.waiting.find((w) => w.runId === PREVIEW_ID)?.reason ?? null;
  return { position, reason, guidelines };
}
