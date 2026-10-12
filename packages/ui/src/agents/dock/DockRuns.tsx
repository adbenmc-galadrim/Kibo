import {
  keyBesideLabel,
  type RunProgressSummary,
  type RunQuestions,
  type RunView,
  runSubject,
} from "@kibo/schema";
import { RunDot } from "@kibo/sdk";
import { cn } from "@kibo/sdk/lib/utils";
import { Copy } from "lucide-react";
import type { ReactNode } from "react";
import { fr } from "../../i18n/fr";
import { frMoments } from "../../i18n/fr-moments";
import { frOverlaps } from "../../i18n/fr-overlaps";
import type { OverlapLine } from "../../overlaps/overlap-labels";
import { stepChip } from "../bar-summary";
import { elapsed, formatDuration, runStateText } from "../format";
import type { DockGroups } from "./dock-runs";

type Props = {
  groups: DockGroups;
  progress: readonly RunProgressSummary[];
  questions: readonly RunQuestions[];
  now: number;
  selected: string | null;
  onSelect(runId: string): void;
  overlapLines?: ReadonlyMap<string, OverlapLine[]>;
  onOverlap?(runId: string, overlapId: string): void;
};

type Row = { run: RunView; ticket: string | null; aside: string; line: ReactNode };

function OverlapLinks({
  runId,
  lines,
  onOverlap,
}: {
  runId: string;
  lines: readonly OverlapLine[];
  onOverlap(runId: string, overlapId: string): void;
}) {
  return (
    <ul className="grid gap-0.5 pb-1 pl-6">
      {lines.map((line) => (
        <li key={line.overlapId}>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-sm text-left text-xs text-muted-foreground hover:underline"
            onClick={() => onOverlap(runId, line.overlapId)}
          >
            <Copy aria-hidden className="size-3" />
            {frOverlaps.bar.with(line.withKey)}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Group({
  title,
  rows,
  selected,
  onSelect,
  overlapLines,
  onOverlap,
}: { title: string; rows: Row[] } & Pick<Props, "selected" | "onSelect" | "overlapLines" | "onOverlap">) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-1">
      <h3 className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul aria-label={title} className="grid gap-0.5">
        {rows.map(({ run, ticket, aside, line }) => (
          <li key={run.id}>
            <button
              type="button"
              aria-pressed={selected === run.id}
              onClick={() => onSelect(run.id)}
              className={cn(
                "grid w-full grid-cols-[0.5rem_1fr_auto] items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
                selected === run.id && "bg-accent",
              )}
            >
              <RunDot state={run.state} />
              <span className="min-w-0 truncate">
                <span className="font-mono text-[13px] underline underline-offset-2">{run.label}</span>
                {ticket && <span className="ml-2 font-mono text-muted-foreground">{ticket}</span>}
              </span>
              <span className="font-mono text-muted-foreground">{aside}</span>
              <span className="col-span-2 col-start-2 min-w-0 truncate text-muted-foreground">{line}</span>
            </button>
            {onOverlap && (overlapLines?.get(run.id)?.length ?? 0) > 0 && (
              <OverlapLinks runId={run.id} lines={overlapLines?.get(run.id) ?? []} onOverlap={onOverlap} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function reportText(summary: RunProgressSummary | undefined): string {
  const report = summary?.report;
  return report ? frMoments.dock.reportLine(report.toCheck, report.undeclared) : frMoments.report.none;
}

function RecentLine({
  run,
  summary,
  questions,
}: {
  run: RunView;
  summary: RunProgressSummary | undefined;
  questions: readonly RunQuestions[];
}) {
  const { open } = runStateText(run, questions, null);
  return (
    <>
      {runSubject(run, reportText(summary))}
      {open > 0 && (
        <>
          {" · "}
          <span className="text-orange-600 dark:text-orange-400">{fr.agents.questionCount(open)}</span>
        </>
      )}
    </>
  );
}

export function DockRuns({
  groups,
  progress,
  questions,
  now,
  selected,
  onSelect,
  overlapLines,
  onOverlap,
}: Props) {
  const t = frMoments.dock;
  const byRun = new Map(progress.map((p) => [p.runId, p]));
  const age = (r: RunView) => formatDuration(elapsed(r, now));
  const active: Row[] = [
    ...groups.active.map((run) => ({
      run,
      ticket: keyBesideLabel(run.label, run.ticketKey),
      aside: age(run),
      line: stepChip(byRun.get(run.id)) ?? run.ticketTitle,
    })),
    ...groups.waiting.map((run) => ({
      run,
      ticket: keyBesideLabel(run.label, run.ticketKey),
      aside: age(run),
      line: <span className="text-brand-strong dark:text-brand">{t.waiting}</span>,
    })),
  ];
  const queued: Row[] = groups.queued.map((run) => ({
    run,
    ticket: keyBesideLabel(run.label, run.ticketKey),
    aside: "",
    line: run.ticketTitle,
  }));
  const recent: Row[] = groups.recent.map((run) => ({
    run,
    ticket: null,
    aside: formatDuration(now - (run.endedAt ?? now)),
    line: <RecentLine run={run} summary={byRun.get(run.id)} questions={questions} />,
  }));
  const empty = active.length + queued.length + recent.length === 0;
  return (
    <div className="grid content-start gap-3">
      {empty && <p className="p-2 text-xs text-muted-foreground">{t.empty}</p>}
      <Group
        title={t.active(active.length)}
        rows={active}
        selected={selected}
        onSelect={onSelect}
        overlapLines={overlapLines}
        onOverlap={onOverlap}
      />
      <Group title={t.queued(queued.length)} rows={queued} selected={selected} onSelect={onSelect} />
      <Group title={t.recent(recent.length)} rows={recent} selected={selected} onSelect={onSelect} />
    </div>
  );
}
