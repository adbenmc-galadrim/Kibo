import { TriangleAlert } from "lucide-react";
import { frChanges } from "../i18n/fr-changes";

export function AgentWorkingBanner({ agent }: { agent: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-2xs text-amber-800 dark:border-amber-600/70 dark:bg-amber-500/10 dark:text-amber-300">
      <TriangleAlert aria-hidden className="mt-px size-4 shrink-0 text-amber-500" />
      {frChanges.commit.agentWorking(agent)}
    </p>
  );
}
