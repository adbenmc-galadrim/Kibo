import type { ComponentDraft, RunView } from "@kibo/schema";

export const isActiveDraft = (d: ComponentDraft): boolean => d.status !== "done" && d.status !== "abandoned";

export const awaitingAction = (d: ComponentDraft): boolean =>
  d.status === "failed" || d.status === "review" || d.status === "permissions";

const generating = (d: ComponentDraft, runs: readonly RunView[]): boolean => {
  if (d.status === "validating") return true;
  if (d.status !== "generating") return false;
  const state = runs.find((r) => r.id === d.runId)?.state;
  return state === "running" || state === "starting";
};

export const indicatorState = (
  drafts: readonly ComponentDraft[],
  runs: readonly RunView[],
): { visible: boolean; awaiting: number; busy: boolean } => {
  const active = drafts.filter(isActiveDraft);
  return {
    visible: active.length > 0,
    awaiting: active.filter(awaitingAction).length,
    busy: active.some((d) => generating(d, runs)),
  };
};
