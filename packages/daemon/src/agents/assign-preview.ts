import { existsSync, realpathSync } from "node:fs";
import { initRun } from "@kibo/core/run-machine";
import { orderQueue, type Plan, tailRank } from "@kibo/core/scheduler";
import {
  type AgentProfile,
  type AssignPreview,
  branchRefOf,
  isTerminal,
  KiboError,
  mainSessionOf,
  type ProjectMeta,
  plannedWorktree,
  type RunView,
  type TicketView,
  WORKTREE_DEFAULTS,
  type WorkspaceStrategy,
} from "@kibo/schema";
import { sessionPreview, type TranscriptCheck } from "./session-decision";

const PREVIEW_ID = "preview";

export type PreviewInput = {
  runs: RunView[];
  projectId: string;
  ticket: TicketView & { key: string };
  profile: AgentProfile;
  guidelines: number;
  at: number;
  plan: (runs: RunView[]) => Plan;
  plannedCwd: string | null;
  transcriptExists: TranscriptCheck;
};

export const activeRunOf = (runs: readonly RunView[], ticketId: string): RunView | null =>
  runs.find((r) => r.ticketId === ticketId && !isTerminal(r.state)) ?? null;

const real = (path: string) => (existsSync(path) ? realpathSync(path) : path);

function plannedWorktreePath(
  folder: string,
  meta: Pick<ProjectMeta, "worktree">,
  ticket: TicketView & { key: string },
) {
  try {
    return plannedWorktree({
      root: folder,
      ticketKey: ticket.key,
      branchRef: branchRefOf(ticket.externalRefs),
      settings: meta.worktree ?? WORKTREE_DEFAULTS,
    }).path;
  } catch (e) {
    if (e instanceof KiboError && e.code === "INVALID_INPUT") return null;
    throw e;
  }
}

export function plannedCwd(
  strategy: WorkspaceStrategy,
  meta: Pick<ProjectMeta, "folder" | "worktree">,
  ticket: TicketView & { key: string },
): string | null {
  if (strategy === "isolated" || meta.folder === null || !existsSync(meta.folder)) return null;
  const folder = realpathSync(meta.folder);
  if (strategy === "repo") return folder;
  const path = plannedWorktreePath(folder, meta, ticket);
  return path === null ? null : real(path);
}

export function previewAssign(input: PreviewInput): AssignPreview {
  const { runs, ticket, profile, guidelines, at } = input;
  if (activeRunOf(runs, ticket.id))
    return { position: null, reason: { kind: "ticket_busy" }, guidelines, session: null };
  const session = sessionPreview(mainSessionOf(runs, ticket.id), {
    profileId: profile.id,
    cwd: input.plannedCwd,
    transcriptExists: input.transcriptExists,
  });
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
      resumedFrom: null,
    },
    tailRank(runs),
    at,
  );
  const withCandidate = [...runs, candidate];
  const next = input.plan(withCandidate);
  if (next.admit.some((a) => a.runId === PREVIEW_ID))
    return { position: null, reason: null, guidelines, session };
  const position = orderQueue(withCandidate).findIndex((r) => r.id === PREVIEW_ID) + 1;
  const reason = next.waiting.find((w) => w.runId === PREVIEW_ID)?.reason ?? null;
  return { position, reason, guidelines, session };
}
