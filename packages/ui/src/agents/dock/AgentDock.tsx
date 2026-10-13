import { type AgentsState, type FileRef, type RunView, reportOfRun, runOverlapCounts } from "@kibo/schema";
import { useState } from "react";
import { frMoments } from "../../i18n/fr-moments";
import { useRunMoments } from "../../moments/use-run-moments";
import { overlapLinesByRun } from "../../overlaps/overlap-labels";
import { useOverlaps } from "../../overlaps/use-overlaps";
import { useProject } from "../../state/use-projects";
import { AgentBar } from "../AgentBar";
import { DockFeed } from "./DockFeed";
import { DockPlan, shownPlan } from "./DockPlan";
import { DockRuns } from "./DockRuns";
import { dockGroups } from "./dock-runs";
import { ResizeBar } from "./ResizeBar";
import { useDockHeight } from "./use-dock-height";

export type AgentDockProps = {
  state: AgentsState;
  now: number;
  online: boolean;
  selected: RunView | null;
  onSelect(runId: string): void;
  onCollapse(): void;
  onLaunch(): void;
  onOpenFile(ref: FileRef): void;
};

function useOpenOverlapLines(state: AgentsState) {
  const open = runOverlapCounts(state).some((c) => c.open > 0);
  const { overlaps } = useOverlaps(open ? { state: "open" } : null);
  return overlapLinesByRun(overlaps, state.runs);
}

function useTicketProgress(run: RunView | null) {
  const project = useProject(run?.projectId ?? null);
  return project?.tickets.find((t) => t.id === run?.ticketId)?.agentProgress ?? null;
}

export function AgentDock({
  state,
  now,
  online,
  selected,
  onSelect,
  onCollapse,
  onLaunch,
  onOpenFile,
}: AgentDockProps) {
  const t = frMoments.dock;
  const dock = useDockHeight();
  const [highlight, setHighlight] = useState<{ runId: string; stepId: string } | null>(null);
  const [focus, setFocus] = useState<{ runId: string; overlapId: string } | null>(null);
  const overlapLines = useOpenOverlapLines(state);
  const { page } = useRunMoments(selected?.id ?? null);
  const progress = useTicketProgress(selected);
  const moments = page?.moments ?? [];
  const shown = selected ? shownPlan(progress, selected.id, page?.internalPlan ?? null) : null;
  const current = highlight && highlight.runId === selected?.id ? highlight.stepId : null;
  const column = "flex min-h-0 flex-col overflow-y-auto p-3";
  return (
    <div className="flex flex-col" style={{ height: dock.height }}>
      <ResizeBar height={dock.height} max={dock.max} onResize={dock.set} onReset={dock.reset} />
      <AgentBar
        state={state}
        now={now}
        online={online}
        expanded
        onToggle={onCollapse}
        onSelect={onSelect}
        onLaunch={onLaunch}
      />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)_minmax(15rem,19rem)] border-t">
        <section aria-label={t.runs} className={`${column} border-r p-2`}>
          <DockRuns
            groups={dockGroups(state, now)}
            progress={state.progress}
            questions={state.questions}
            now={now}
            selected={selected?.id ?? null}
            onSelect={onSelect}
            overlapLines={overlapLines}
            onOverlap={(runId, overlapId) => {
              onSelect(runId);
              setFocus({ runId, overlapId });
            }}
          />
        </section>
        <section aria-label={t.feed} className="flex min-h-0 flex-col overflow-hidden p-3">
          {selected ? (
            <DockFeed
              key={selected.id}
              run={selected}
              resumable={state.resumable.includes(selected.id)}
              questions={state.questions.find((q) => q.runId === selected.id) ?? null}
              now={now}
              moments={moments}
              runs={state.runs}
              steps={shown?.plan ?? []}
              report={progress ? reportOfRun(progress, selected.id) : null}
              highlightStep={current}
              focusOverlap={focus?.runId === selected.id ? focus.overlapId : null}
              onOpenFile={onOpenFile}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t.pick}</p>
          )}
        </section>
        <section aria-label={t.plan} className={`${column} border-l`}>
          {selected && shown && (
            <DockPlan
              shown={shown}
              moments={moments}
              current={current}
              onStep={(stepId) => setHighlight({ runId: selected.id, stepId })}
            />
          )}
        </section>
      </div>
    </div>
  );
}
