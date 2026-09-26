import { type ComponentDraft, MAX_DRAFT_ATTEMPTS } from "@kibo/schema";

export type DraftStep = 1 | 2 | 3 | 4 | 5;

export function draftStep(d: Pick<ComponentDraft, "status"> | null): DraftStep {
  switch (d?.status) {
    case "generating":
      return 2;
    case "validating":
    case "failed":
    case "review":
      return 3;
    case "permissions":
      return 4;
    case "done":
      return 5;
    default:
      return 1;
  }
}

export function draftActions(d: ComponentDraft): {
  canRetry: boolean;
  codeFallback: boolean;
  canAbandon: boolean;
} {
  const failed = d.status === "failed";
  const exhausted = d.attempts >= MAX_DRAFT_ATTEMPTS || d.failure?.kind === "config_changed";
  return {
    canRetry: failed && !exhausted,
    codeFallback: failed && exhausted,
    canAbandon: d.status !== "done" && d.status !== "abandoned",
  };
}
