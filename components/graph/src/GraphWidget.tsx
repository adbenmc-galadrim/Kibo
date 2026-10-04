import type { TicketView } from "@kibo/schema";
import { StatusDot, useEntities, useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { useMemo } from "react";
import { compareKeys, criticalPath, type GraphEdge } from "./critical-path";
import { graphInput } from "./filter";
import { fr } from "./fr";
import { GraphFramed, GraphView } from "./lazy-panels";
import { readyTickets, waitingOn } from "./waiting";

const MAX_WAITING_ROWS = 6;

type WaitingRow = { id: string; label: string };

type Summary = { chain: TicketView[]; rows: WaitingRow[]; ready: number };

function summarize(tickets: TicketView[], edges: GraphEdge[]): Summary {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const keyOf = (id: string) => byId.get(id)?.keyLabel ?? id;
  const waiting = waitingOn(tickets, edges);
  const waitsFor = (id: string) => fr.waitsFor(keyOf(id), (waiting.get(id) ?? []).map(keyOf));
  const blocked = tickets.filter((t) => t.statusId === "blocked");
  const rows: WaitingRow[] = [
    ...[...waiting.keys()]
      .filter((id) => byId.get(id)?.statusId !== "blocked")
      .map((id) => ({ id, label: waitsFor(id) })),
    ...blocked
      .map((t) => ({ t, keyed: waiting.has(t.id) && !t.blockedReason }))
      .sort((a, b) => compareKeys(a.t.keyLabel, b.t.keyLabel))
      .map(({ t, keyed }) => ({
        id: t.id,
        label: keyed ? waitsFor(t.id) : fr.blockedStatus(t.keyLabel, t.blockedReason ?? null),
      })),
  ];
  const chain = criticalPath(tickets, edges).flatMap((id) => byId.get(id) ?? []);
  return { chain, rows, ready: readyTickets(tickets, edges).length };
}

function useSummary(): { summary: Summary; loading: boolean; failed: boolean } {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const assignee = sdk.config.filter === "all" ? "all" : "mine-and-agents";
  const summary = useMemo(() => {
    const input = graphInput(
      tickets.data,
      links.data,
      { assignee, hideDone: true, domain: null },
      sdk.viewer,
    );
    return summarize(input.tickets, input.edges);
  }, [tickets.data, links.data, assignee, sdk.viewer]);
  return {
    summary,
    loading: tickets.loading || links.loading,
    failed: tickets.error !== null || links.error !== null,
  };
}

function Chain({ chain, onOpen }: { chain: TicketView[]; onOpen(id: string): void }) {
  return (
    <ol aria-label={fr.critical} className="flex flex-wrap items-center gap-2">
      {chain.map((t, i) => (
        <li key={t.id} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpen(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs hover:bg-accent",
              t.statusId === "blocked" && "border-red-600 dark:border-red-500",
            )}
          >
            <StatusDot statusId={t.statusId} />
            {t.keyLabel}
          </button>
        </li>
      ))}
    </ol>
  );
}

function Waiting({ rows, onOpen }: { rows: WaitingRow[]; onOpen(id: string): void }) {
  const shown = rows.slice(0, MAX_WAITING_ROWS);
  const hidden = rows.length - shown.length;
  return (
    <div className="grid min-h-0 gap-1">
      <p className="text-muted-foreground">{fr.waiting}</p>
      <ol aria-label={fr.waiting} className="grid min-h-0 gap-0.5 overflow-hidden">
        {shown.map((row) => (
          <li key={row.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              className="w-full truncate rounded-sm px-1 py-0.5 text-left hover:bg-accent"
            >
              {row.label}
            </button>
          </li>
        ))}
        {hidden > 0 && <li className="px-1 text-muted-foreground">{fr.more(hidden)}</li>}
      </ol>
    </div>
  );
}

function Counters({ summary }: { summary: Summary }) {
  const counters = [
    { label: fr.blockedCount, value: summary.rows.length },
    { label: fr.readyCount, value: summary.ready },
    { label: fr.critical, value: summary.chain.length },
  ];
  return (
    <div className="grid h-full grid-cols-3 content-center gap-2 p-3 text-center">
      {counters.map((c) => (
        <fieldset key={c.label} aria-label={c.label} className="min-w-0">
          <dl className="grid h-full grid-rows-[1fr_auto] gap-1">
            <dt className="self-end text-2xs leading-tight text-balance text-muted-foreground">{c.label}</dt>
            <dd className="text-2xl font-semibold">{c.value}</dd>
          </dl>
        </fieldset>
      ))}
    </div>
  );
}

function SummaryWidget({ small }: { small: boolean }) {
  const sdk = useSdk();
  const { summary, loading, failed } = useSummary();
  const open = (id: string) => sdk.openTicket(id);

  if (failed) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  if (loading) return <div className="h-full" />;
  if (small) return <Counters summary={summary} />;
  if (summary.chain.length === 0 && summary.rows.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{fr.emptyWidget}</p>;
  }
  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-4 text-xs">
      {summary.chain.length > 0 && (
        <div className="grid gap-2">
          <p className="text-muted-foreground">{fr.widgetTitle(summary.chain.length)}</p>
          <Chain chain={summary.chain} onOpen={open} />
        </div>
      )}
      {summary.rows.length > 0 && <Waiting rows={summary.rows} onOpen={open} />}
      <Button
        variant="link"
        className="mt-auto h-auto w-fit p-0 text-xs font-normal text-muted-foreground"
        onClick={() => sdk.openView("graph")}
      >
        {fr.open}
      </Button>
    </div>
  );
}

export function GraphWidget() {
  const { format } = useSdk();
  if (format === "full") return <GraphView />;
  if (format === "large" || format === "half") return <GraphFramed />;
  return <SummaryWidget small={format === "small"} />;
}
