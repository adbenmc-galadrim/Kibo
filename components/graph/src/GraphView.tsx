import { useSdk } from "@kibo/sdk";
import { useMemo, useState } from "react";
import { type GraphFilter, initialFilter } from "./filter";
import { fr } from "./fr";
import { GraphCanvas } from "./GraphCanvas";
import { GraphToolbar } from "./GraphToolbar";
import type { GraphMode } from "./graph-model";
import { DEFAULT_DISPLAY, type GraphDisplay, useGraphData } from "./use-graph-data";
import { ViewMenu } from "./ViewMenu";

const toggled = (set: ReadonlySet<string>, value: string): Set<string> => {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
};

export function GraphView() {
  const sdk = useSdk();
  const [showCritical, setShowCritical] = useState(true);
  const [filter, setFilter] = useState<GraphFilter>(() => initialFilter(sdk.config));
  const [display, setDisplay] = useState<GraphDisplay>(DEFAULT_DISPLAY);
  const data = useGraphData(filter, display);
  const { input, path, counts } = data;
  const critical = useMemo(() => new Set(showCritical ? path : []), [path, showCritical]);
  const blocked = input.tickets.filter((t) => path.includes(t.id) && t.statusId === "blocked").length;
  const setMode = (mode: GraphMode) => setDisplay((d) => ({ ...d, mode }));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <GraphToolbar
          tickets={data.allTickets}
          filter={filter}
          setFilter={setFilter}
          mode={display.mode}
          onMode={setMode}
          showCritical={showCritical}
          onToggleCritical={() => setShowCritical((v) => !v)}
          doneCount={data.doneCount}
        >
          <ViewMenu
            prefixes={data.prefixes}
            groupBy={display.groupBy}
            disabled={display.mode !== "waves"}
            onGroupBy={(groupBy) => setDisplay((d) => ({ ...d, groupBy, collapsed: new Set() }))}
            onExpandAll={() => setDisplay((d) => ({ ...d, collapsed: new Set() }))}
            onCollapseAll={() => setDisplay((d) => ({ ...d, collapsed: new Set(data.groupValues) }))}
          />
        </GraphToolbar>
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {fr.counts(counts.total, counts.open, counts.startable)}
        </span>
        {path.length > 0 && (
          <span className="text-xs text-muted-foreground">{fr.summary(path.length, blocked)}</span>
        )}
      </div>
      {data.failed && (
        <p role="alert" className="p-4 text-sm text-destructive">
          {fr.loadFailed}
        </p>
      )}
      {!data.loading && !data.failed && data.empty ? (
        <p className="grid flex-1 place-items-center p-6 text-sm text-muted-foreground">{fr.emptyView}</p>
      ) : (
        <div className="min-h-0 flex-1">
          <GraphCanvas
            tickets={input.tickets}
            model={data.model}
            critical={critical}
            runs={data.runs}
            onOpen={(id) => sdk.openTicket(id)}
            onToggleFrame={(value) => setDisplay((d) => ({ ...d, collapsed: toggled(d.collapsed, value) }))}
          />
        </div>
      )}
    </div>
  );
}
