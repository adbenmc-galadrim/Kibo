import { useEntities, useSdk } from "@kibo/sdk";
import { useMemo } from "react";
import { criticalPath } from "./critical-path";
import { type GraphFilter, graphInput } from "./filter";
import { layoutGraph } from "./layout";

export function initialFilter(config: Record<string, unknown>): GraphFilter {
  return {
    assignee: config.filter === "all" ? "all" : "mine-and-agents",
    hideDone: config.hideDone === true,
    domain: null,
  };
}

export function useGraphData(filter: GraphFilter) {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const runList = useEntities("run");
  const runs = useMemo(() => new Map(runList.data.map((r) => [r.ticketId, r])), [runList.data]);
  const input = useMemo(
    () => graphInput(tickets.data, links.data, filter, sdk.viewer),
    [tickets.data, links.data, filter, sdk.viewer],
  );
  const layout = useMemo(() => layoutGraph(input.tickets, input.edges), [input]);
  const path = useMemo(() => criticalPath(input.tickets, input.edges), [input]);
  return {
    allTickets: tickets.data,
    input,
    layout,
    path,
    runs,
    loading: tickets.loading || links.loading,
    failed: tickets.error !== null || links.error !== null || runList.error !== null,
    hasBlocks: input.edges.some((e) => e.type === "blocks"),
  };
}
