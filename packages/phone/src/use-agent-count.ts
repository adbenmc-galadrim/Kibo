import { undecidedActionIds } from "@kibo/schema";
import { useProjectAgent } from "@kibo/ui/project-agent";

export function useAgentPendingCount(projectId: string): number {
  const { view } = useProjectAgent(projectId);
  return (view?.batches ?? [])
    .filter((batch) => batch.status === "pending")
    .reduce((count, batch) => count + undecidedActionIds(batch).length, 0);
}
