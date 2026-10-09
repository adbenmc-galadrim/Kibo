import {
  type AgentsState,
  type FileRef,
  isTerminal,
  type RunLogEntry,
  type RunView,
  runSubject,
} from "@kibo/schema";
import { RUN_TEXT, RunDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import { Bot, ChevronDown, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../i18n/fr";
import { elapsed, formatDuration, reasonText } from "./format";
import { JournalRuns } from "./journal-runs";
import { RunDetail } from "./RunDetail";
import { journalUnavailable } from "./RunJournal";
import { RunStateLabel } from "./RunStateLabel";

type Props = {
  state: AgentsState;
  now: number;
  selected: RunView | null;
  log: RunLogEntry[] | null;
  missing?: boolean;
  empty?: boolean;
  onSelect: (runId: string) => void;
  onCollapse: () => void;
  onLaunch: () => void;
  onOpenFile: (ref: FileRef) => void;
};

type Row = { run: RunView; detail: ReactNode; aside: ReactNode };

function Group({
  title,
  rows,
  selected,
  onSelect,
}: {
  title: string;
  rows: Row[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-1">
      <h3 className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul aria-label={title} className="grid gap-0.5">
        {rows.map(({ run, detail, aside }) => (
          <li key={run.id}>
            <button
              type="button"
              aria-pressed={selected === run.id}
              onClick={() => onSelect(run.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
                selected === run.id && "bg-accent",
                run.state === "waiting_input" && "ring-1 ring-brand",
              )}
            >
              <RunDot state={run.state} />
              <span className="shrink-0 font-mono text-[13px]">{run.label}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{detail}</span>
              <span className="shrink-0 font-mono text-muted-foreground">{aside}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgentDrawer({
  state,
  now,
  selected,
  log,
  missing = false,
  empty = false,
  onSelect,
  onCollapse,
  onLaunch,
  onOpenFile,
}: Props) {
  const byId = new Map(state.runs.map((r) => [r.id, r]));
  const waitingRuns = state.runs.filter((r) => r.state === "waiting_input");
  const age = (r: RunView) => formatDuration(elapsed(r, now));
  const running: Row[] = state.runs
    .filter((r) => r.state === "running" || r.state === "starting")
    .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))
    .map((run) => ({ run, detail: runSubject(run, run.ticketTitle), aside: age(run) }));
  const waiting: Row[] = waitingRuns.map((run) => ({
    run,
    detail: runSubject(run, run.ticketTitle),
    aside: age(run),
  }));
  const queued: Row[] = state.queue.flatMap((entry) => {
    const run = byId.get(entry.runId);
    if (!run) return [];
    const detail = runSubject(run, run.priority ? fr.queue.priority : reasonText(entry.reason));
    return [{ run, detail, aside: <span className={RUN_TEXT.queued}>{`#${entry.position}`}</span> }];
  });
  const finished: Row[] = state.runs
    .filter((r) => isTerminal(r.state))
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    .slice(0, 5)
    .map((run) => ({
      run,
      detail: (
        <>
          {run.ticketKey && `${run.ticketKey} · `}
          <RunStateLabel run={run} questions={state.questions} />
        </>
      ),
      aside: formatDuration(now - (run.endedAt ?? now)),
    }));
  const g = fr.agents.groups;
  return (
    <div className="grid">
      <div className="flex h-11 items-center gap-3 px-3">
        <Bot aria-hidden className="size-4" />
        <span className="text-sm font-medium">{fr.agents.bar}</span>
        <span className="text-xs text-muted-foreground">
          {fr.agents.summary(state.host.used, state.host.hostSlots, state.queue.length, waitingRuns.length)}
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={onLaunch}>
          <Plus />
          {fr.agents.launch}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label={fr.agents.collapse}
          aria-expanded
          onClick={onCollapse}
        >
          <ChevronDown />
        </Button>
      </div>
      <div className="grid h-[22rem] grid-cols-[minmax(18rem,24rem)_1fr] border-t">
        <nav aria-label={fr.agents.runs} className="grid content-start gap-3 overflow-y-auto border-r p-2">
          {state.runs.length === 0 && <p className="p-2 text-xs text-muted-foreground">{fr.agents.empty}</p>}
          <Group
            title={g.running(state.host.used, state.host.hostSlots)}
            rows={running}
            selected={selected?.id ?? null}
            onSelect={onSelect}
          />
          <Group title={g.waiting} rows={waiting} selected={selected?.id ?? null} onSelect={onSelect} />
          <Group
            title={g.queued(queued.length)}
            rows={queued}
            selected={selected?.id ?? null}
            onSelect={onSelect}
          />
          <Group title={g.finished} rows={finished} selected={selected?.id ?? null} onSelect={onSelect} />
        </nav>
        <div className="flex min-h-0 flex-col p-3">
          {selected ? (
            <JournalRuns.Provider value={state.runs}>
              <RunDetail
                key={selected.id}
                run={selected}
                resumable={state.resumable.includes(selected.id)}
                questions={state.questions.find((q) => q.runId === selected.id) ?? null}
                now={now}
                log={log}
                missing={journalUnavailable({ missing, empty }, isTerminal(selected.state))}
                onOpenFile={onOpenFile}
              />
            </JournalRuns.Provider>
          ) : (
            <p className="text-sm text-muted-foreground">{fr.agents.pick}</p>
          )}
        </div>
      </div>
    </div>
  );
}
