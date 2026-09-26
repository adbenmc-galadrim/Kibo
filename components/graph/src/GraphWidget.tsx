import type { TicketView } from "@kibo/schema";
import { StatusDot, useEntities, useSdk } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { useMemo } from "react";
import { criticalPath } from "./critical-path";
import { graphInput } from "./filter";
import { fr } from "./fr";

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

export function GraphWidget() {
  const sdk = useSdk();
  const tickets = useEntities("ticket");
  const links = useEntities("link");
  const assignee = sdk.config.filter === "all" ? "all" : "mine-and-agents";
  const chain = useMemo(() => {
    const input = graphInput(
      tickets.data,
      links.data,
      { assignee, hideDone: true, domain: null },
      sdk.viewer,
    );
    const byId = new Map(input.tickets.map((t) => [t.id, t]));
    return criticalPath(input.tickets, input.edges).flatMap((id) => byId.get(id) ?? []);
  }, [tickets.data, links.data, assignee, sdk.viewer]);
  const firstBlocked = chain.find((t) => t.statusId === "blocked");

  if (tickets.error || links.error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  if (tickets.loading || links.loading) return <div className="h-full" />;
  if (chain.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{fr.emptyWidget}</p>;
  }
  return (
    <div className="grid h-full content-center gap-3 p-4 text-xs">
      <p className="text-muted-foreground">{fr.widgetTitle(chain.length)}</p>
      <Chain chain={chain} onOpen={(id) => sdk.openTicket(id)} />
      {firstBlocked?.blockedReason && (
        <p className="text-red-600 dark:text-red-500">
          {fr.blocked(firstBlocked.keyLabel, firstBlocked.blockedReason)}
        </p>
      )}
      <Button
        variant="link"
        className="h-auto w-fit p-0 text-xs font-normal text-muted-foreground"
        onClick={() => sdk.openView("graph")}
      >
        {fr.open}
      </Button>
    </div>
  );
}
