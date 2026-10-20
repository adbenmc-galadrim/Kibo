import { agentTracesShown, liveRun, useEntities } from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { useMemo } from "react";
import { type PrStacksModel, prStacks } from "./pr-stacks";

export function usePrStacks(): { model: PrStacksModel; loading: boolean; failed: boolean } {
  const tickets = useEntities("ticket");
  const runs = useEntities("run");
  const shown = agentTracesShown(useComponentSettings().agentExecution);
  const live = useMemo(
    () => new Set(shown ? runs.data.filter((r) => liveRun(r) !== null).map((r) => r.ticketId) : []),
    [runs.data, shown],
  );
  const model = useMemo(() => prStacks({ tickets: tickets.data, live }), [tickets.data, live]);
  return { model, loading: tickets.loading, failed: tickets.error !== null };
}
