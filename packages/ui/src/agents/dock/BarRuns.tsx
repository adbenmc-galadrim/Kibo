import { type AgentsState, runDeliverySteps, runSubagents, runSubject } from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import { useRef } from "react";
import { fr } from "../../i18n/fr";
import { stepChip } from "../bar-summary";
import { elapsed, formatDuration } from "../format";
import { useWrappedCount } from "../use-wrapped-count";
import { activeByRun, SubagentLines } from "./SubagentLines";

export type BarRunsProps = {
  state: AgentsState;
  now: number;
  onSelect(runId: string): void;
  onSubagent?(runId: string, subagentId: string): void;
  onMore(): void;
};

export function BarRuns({ state, now, onSelect, onSubagent, onMore }: BarRunsProps) {
  const running = state.runs
    .filter((r) => r.state === "running" || r.state === "starting")
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));
  const waiting = state.runs.filter((r) => r.state === "waiting_input");
  const progress = new Map(state.progress.map((p) => [p.runId, p]));
  const delivery = new Map(runDeliverySteps(state).map((d) => [d.runId, d]));
  const listRef = useRef<HTMLUListElement>(null);
  const hidden = useWrappedCount(listRef, running.map((r) => r.id).join(" "));
  const visible = running.length - hidden;
  const subagents = activeByRun(runSubagents(state));
  const lines = Math.max(0, ...running.map((r) => subagents.get(r.id)?.length ?? 0));
  return (
    <>
      <ul
        ref={listRef}
        style={{ height: `${1 + lines}rem` }}
        className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-[100vh] overflow-hidden"
      >
        {running.map((r, index) => (
          <li
            key={r.id}
            data-run={r.id}
            aria-hidden={index >= visible || undefined}
            className="grid shrink-0"
          >
            <button
              type="button"
              tabIndex={index >= visible ? -1 : undefined}
              onClick={() => onSelect(r.id)}
              className="flex h-4 items-center gap-1.5 whitespace-nowrap"
            >
              <RunDot state={r.state} />
              <span className="font-mono underline underline-offset-2">{r.label}</span>
              <span className="text-muted-foreground">
                {runSubject(
                  r,
                  stepChip(progress.get(r.id), delivery.get(r.id)) ?? formatDuration(elapsed(r, now)),
                )}
              </span>
            </button>
            <SubagentLines
              subagents={subagents.get(r.id) ?? []}
              now={now}
              tabIndex={index >= visible ? -1 : undefined}
              className="pl-3"
              onOpen={(id) => (onSubagent ? onSubagent(r.id, id) : onSelect(r.id))}
            />
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 shrink-0 px-1.5 font-mono text-xs"
          aria-label={fr.agents.moreRuns(hidden)}
          onClick={onMore}
        >
          {`+${hidden}`}
        </Button>
      )}
      {waiting.map((r) => (
        <span key={r.id} className="flex shrink-0 items-center gap-1.5 border-l pl-3">
          <RunDot state="waiting_input" />
          <span className="font-mono">{r.label}</span>
          <span className="text-muted-foreground">{runSubject(r, fr.agents.waitingShort)}</span>
          <Button
            size="sm"
            className="h-6 px-2.5 text-xs bg-brand-strong text-white hover:bg-brand-strong/90"
            aria-label={fr.agents.answerTo(r.label)}
            onClick={() => onSelect(r.id)}
          >
            {fr.agents.answer}
          </Button>
        </span>
      ))}
    </>
  );
}
