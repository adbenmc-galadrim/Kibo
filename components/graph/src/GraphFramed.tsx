import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { useMemo, useState } from "react";
import type { GraphFilter } from "./filter";
import { fr } from "./fr";
import { GraphCanvas } from "./GraphCanvas";
import { initialFilter, useGraphData } from "./use-graph-data";

const TOGGLE = "h-6 bg-card px-2 text-2xs aria-pressed:bg-accent dark:aria-pressed:bg-accent";

export function GraphFramed() {
  const sdk = useSdk();
  const [filter, setFilter] = useState<GraphFilter>(() => initialFilter(sdk.config));
  const { input, layout, path, runs, loading, failed, hasBlocks } = useGraphData(filter);
  const critical = useMemo(() => new Set(path), [path]);

  if (failed) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.loadFailed}
      </p>
    );
  }
  return (
    <div className="relative h-full">
      {!loading && !hasBlocks ? (
        <p className="grid h-full place-items-center p-6 text-sm text-muted-foreground">{fr.emptyView}</p>
      ) : (
        <GraphCanvas
          compact
          tickets={input.tickets}
          edges={input.edges}
          layout={layout}
          critical={critical}
          runs={runs}
          onOpen={(id) => sdk.openTicket(id)}
        />
      )}
      <div className="absolute top-2 right-2 flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className={TOGGLE}
          aria-pressed={filter.hideDone}
          onClick={() => setFilter((f) => ({ ...f, hideDone: !f.hideDone }))}
        >
          {fr.hideDone}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={TOGGLE}
          aria-pressed={filter.assignee === "all"}
          onClick={() =>
            setFilter((f) => ({ ...f, assignee: f.assignee === "all" ? "mine-and-agents" : "all" }))
          }
        >
          {fr.all}
        </Button>
      </div>
    </div>
  );
}
