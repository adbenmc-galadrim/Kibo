import type { AgentsState, ComponentDraft } from "@kibo/schema";
import { isActiveDraft } from "../state/draft-activity";

export { awaitingAction, indicatorState } from "../state/draft-activity";

export type RunStatus = { kind: "queued"; position: number } | { kind: "running" } | { kind: "waiting" };

export const groupDrafts = (
  drafts: readonly ComponentDraft[],
): { active: ComponentDraft[]; finished: ComponentDraft[] } => ({
  active: drafts.filter(isActiveDraft),
  finished: drafts.filter((d) => !isActiveDraft(d)),
});

export function runStatus(draft: ComponentDraft, agents: AgentsState | null): RunStatus | null {
  if (!agents || !draft.runId) return null;
  const run = agents.runs.find((r) => r.id === draft.runId);
  switch (run?.state) {
    case "queued": {
      const entry = agents.queue.find((q) => q.runId === run.id);
      return entry ? { kind: "queued", position: entry.position } : null;
    }
    case "starting":
    case "running":
      return { kind: "running" };
    case "waiting_input":
      return { kind: "waiting" };
    default:
      return null;
  }
}
