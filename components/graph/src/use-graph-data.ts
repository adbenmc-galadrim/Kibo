import { isGroup, type TicketRun, type TicketView } from "@kibo/schema";
import { liveRun, useEntities, useSdk } from "@kibo/sdk";
import { useMemo } from "react";
import { criticalPath } from "./critical-path";
import { ENSEMBLE_PREFIX, ensembleIndex } from "./ensembles";
import { type GraphFilter, graphInput } from "./filter";
import { buildGraphModel, type GraphMode } from "./graph-model";
import { groupTickets, labelPrefixes } from "./groups";
import type { WaveTicket } from "./waves";

export type GraphDisplay = { mode: GraphMode; groupBy: string | null; collapsed: ReadonlySet<string> };

export const DEFAULT_DISPLAY: GraphDisplay = { mode: "waves", groupBy: null, collapsed: new Set() };

const toWave = (t: TicketView, runs: ReadonlyMap<string, TicketRun>): WaveTicket => ({
  id: t.id,
  key: t.key,
  statusId: t.statusId,
  startable: t.startable,
  live: liveRun(runs.get(t.id) ?? null) !== null,
  labels: t.labels,
});

function countsOf(all: readonly TicketView[]) {
  const tickets = all.filter((t) => !isGroup(t));
  const done = tickets.filter((t) => t.statusId === "done").length;
  return {
    total: tickets.length,
    open: tickets.length - done,
    startable: tickets.filter((t) => t.startable).length,
  };
}

export function useGraphData(filter: GraphFilter, display: GraphDisplay = DEFAULT_DISPLAY) {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const runList = useEntities("run");
  const runs = useMemo(() => new Map(runList.data.map((r) => [r.ticketId, r])), [runList.data]);
  const input = useMemo(
    () => graphInput(tickets.data, links.data, filter, sdk.viewer),
    [tickets.data, links.data, filter, sdk.viewer],
  );
  const scope = useMemo(
    () => graphInput(tickets.data, [], { ...filter, showDone: true, startable: false }, sdk.viewer).tickets,
    [tickets.data, filter, sdk.viewer],
  );
  const ensembles = useMemo(() => ensembleIndex(tickets.data), [tickets.data]);
  const model = useMemo(
    () =>
      buildGraphModel(
        input.tickets.map((t) => toWave(t, runs)),
        input.edges,
        { ...display, showDone: filter.showDone, ensembles },
      ),
    [input, runs, display, filter.showDone, ensembles],
  );
  const path = useMemo(() => criticalPath(input.tickets, input.edges), [input]);
  const groupValues = useMemo(
    () => [
      ...groupTickets(input.tickets, {
        prefix: display.groupBy ?? ENSEMBLE_PREFIX,
        collapsed: new Set(),
        ensembles: display.groupBy === null ? ensembles : undefined,
      }).groups.keys(),
    ],
    [input, display.groupBy, ensembles],
  );
  const doneHidden = scope.filter(
    (t) => !isGroup(t) && t.statusId === "done" && (!filter.startable || t.startable),
  ).length;
  return {
    allTickets: tickets.data,
    input,
    model,
    path,
    runs,
    counts: countsOf(scope),
    doneCount: doneHidden,
    prefixes: labelPrefixes(scope),
    groupValues,
    loading: tickets.loading || links.loading,
    failed: tickets.error !== null || links.error !== null || runList.error !== null,
    empty:
      display.mode === "waves" ? input.tickets.length === 0 : !input.edges.some((e) => e.type === "blocks"),
  };
}
