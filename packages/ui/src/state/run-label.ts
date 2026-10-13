import type { RunView } from "@kibo/schema";

export const runLabelIn =
  (runs: readonly Pick<RunView, "id" | "label">[] | undefined) =>
  (runId: string): string =>
    runs?.find((r) => r.id === runId)?.label ?? runId;
