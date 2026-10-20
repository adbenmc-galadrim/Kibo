import { useSdk } from "@kibo/sdk";
import { useMemo, useState } from "react";
import { EmptyGraph } from "./EmptyGraph";
import { type GraphFilter, initialFilter } from "./filter";
import { fr } from "./fr";
import { GraphCanvas } from "./GraphCanvas";
import { ColumnsMenu, GraphToolbar } from "./GraphToolbar";
import { effectiveColumns, type GraphColumns, type GraphMode, initialColumns } from "./graph-model";
import { SprintLanes } from "./SprintLanes";
import { SprintToolbar } from "./SprintToolbar";
import { DEFAULT_DISPLAY, type GraphDisplay, useGraphData } from "./use-graph-data";
import { useSprintLanes } from "./use-sprint-lanes";
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
  const [columns, setColumns] = useState<GraphColumns>(() => initialColumns(sdk.config));
  const data = useGraphData(filter, display);
  const lanes = useSprintLanes();
  const { input, path, counts } = data;
  const critical = useMemo(() => new Set(showCritical ? path : []), [path, showCritical]);
  const blocked = input.tickets.filter((t) => path.includes(t.id) && t.statusId === "blocked").length;
  const setMode = (mode: GraphMode) => setDisplay((d) => ({ ...d, mode }));
  const onToggleCritical = () => setShowCritical((v) => !v);
  const onNewFeature = () => sdk.openView("planning", { intent: { kind: "newFeature" } });

  const hasSprints = lanes.lanes.some((l) => l.code !== null);
  if (effectiveColumns(columns, hasSprints) === "sprints") {
    return (
      <div className="flex h-full flex-col">
        <SprintToolbar
          model={lanes}
          prefixes={data.prefixes}
          onColumns={setColumns}
          onGroupBy={(groupBy) => {
            setColumns("waves");
            setDisplay((d) => ({ ...d, groupBy, collapsed: new Set() }));
          }}
          options={{
            tickets: data.allTickets,
            filter,
            setFilter,
            showCritical,
            onToggleCritical,
            doneCount: data.doneCount,
          }}
        />
        <div className="min-h-0 flex-1">
          <SprintLanes model={lanes} onOpen={(id) => sdk.openTicket(id)} onNewFeature={onNewFeature} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <ColumnsMenu value="waves" disabled={!hasSprints} className="h-7 text-xs" onChange={setColumns} />
        <GraphToolbar
          tickets={data.allTickets}
          filter={filter}
          setFilter={setFilter}
          mode={display.mode}
          onMode={setMode}
          showCritical={showCritical}
          onToggleCritical={onToggleCritical}
          doneCount={data.doneCount}
        >
          <ViewMenu
            prefixes={data.prefixes}
            groupBy={display.groupBy}
            framed={data.groupValues.length > 0}
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
        {data.model.implied.length > 0 && (
          <span className="text-xs text-muted-foreground/80">
            {fr.impliedHidden(data.model.implied.length)}
          </span>
        )}
        {path.length > 0 && (
          <span className="text-xs text-muted-foreground">{fr.summary(path.length, blocked)}</span>
        )}
      </div>
      {data.failed && (
        <p role="alert" className="p-4 text-sm text-destructive">
          {fr.loadFailed}
        </p>
      )}
      {!data.loading && !data.failed && data.allTickets.length === 0 ? (
        <EmptyGraph onNewFeature={onNewFeature} className="flex-1" />
      ) : !data.loading && !data.failed && data.empty ? (
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
