import type { Overlap, ParallelRun } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight, Copy, Eye, FileCode, GitBranch, LoaderCircle } from "lucide-react";
import { Mention } from "../agents/mention/Mention";
import { frOverlaps } from "../i18n/fr-overlaps";
import { overlapState, overlapWhat } from "./overlap-labels";

type Props = {
  run: ParallelRun;
  overlaps: readonly Overlap[];
  now: number;
  onSeeWork(runId: string): void;
  onSeeFiles(overlapId: string): void;
};

const t = frOverlaps.parallel;
const LABEL = "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

function ago(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  return minutes < 60 ? t.minutes(minutes) : t.hours(Math.floor(minutes / 60));
}

function stepIndex(run: ParallelRun): number | null {
  const index = run.plan?.findIndex((s) => s.status === "doing") ?? -1;
  return index >= 0 ? index + 1 : null;
}

function workspaceText(run: ParallelRun): string {
  if (run.workspace === "shared") return t.shared;
  if (run.workspace === "isolated") return t.isolated;
  if (run.workspace === "repo") return t.repo;
  return t.worktree(run.worktreeName ?? "");
}

function Files({ run }: { run: ParallelRun }) {
  if (run.files.length === 0) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger className={`group flex items-center gap-1 ${LABEL}`}>
        <ChevronRight aria-hidden className="size-3 transition-transform group-data-[state=open]:rotate-90" />
        {t.files(run.files.length)}
        {run.truncated && <span className="normal-case">{` · ${t.truncated}`}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="grid gap-1 pt-1">
          {run.files.map((f) => (
            <li key={f.path} className="flex min-w-0 items-center gap-2 text-xs">
              <FileCode aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <code className="min-w-0 flex-1 truncate font-mono">{f.path}</code>
              <span className="font-mono text-green-700 dark:text-green-400">{`+${f.added}`}</span>
              <span className="font-mono text-red-700 dark:text-red-400">{`−${f.removed}`}</span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Exports({ run }: { run: ParallelRun }) {
  if (run.exports.length === 0) return null;
  return (
    <div className="grid gap-1">
      <p className={LABEL}>{t.exports(run.exports.length)}</p>
      <ul className="grid gap-0.5">
        {run.exports.map((e) => (
          <li key={`${e.path}:${e.name}`} className="flex min-w-0 items-baseline gap-2 text-xs">
            <code className="font-mono font-semibold">{e.name}</code>
            <code className="min-w-0 truncate font-mono text-muted-foreground">{e.path}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OverlapRow({
  overlap,
  now,
  onSeeFiles,
}: {
  overlap: Overlap;
  now: number;
  onSeeFiles(id: string): void;
}) {
  const what = overlapWhat(overlap.detail);
  return (
    <li data-overlap-row={overlap.id} className="grid gap-1 border-t pt-2 text-xs">
      <p className="flex min-w-0 items-center gap-1.5">
        <Copy aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          {what.code && <code className="font-mono">{what.code}</code>}
          {what.code ? ` ${what.text}` : what.text}
        </span>
        <span className="shrink-0 text-muted-foreground">{overlapState(overlap, now)}</span>
      </p>
      <Button size="sm" variant="ghost" className="h-7 w-fit text-xs" onClick={() => onSeeFiles(overlap.id)}>
        <Eye aria-hidden />
        {frOverlaps.moment.seeFiles}
      </Button>
    </li>
  );
}

export function ParallelRunCard({ run, overlaps, now, onSeeWork, onSeeFiles }: Props) {
  return (
    <li data-run={run.runId} className="grid gap-2 rounded-md border p-3">
      <Mention runId={run.runId} label={run.name} className="w-fit text-sm underline underline-offset-2" />
      <p className="text-xs text-muted-foreground">{t.started(run.ticketTitle, ago(now - run.startedAt))}</p>
      {run.step && (
        <p className="flex items-center gap-1.5 text-xs">
          <LoaderCircle aria-hidden className="size-3.5 text-muted-foreground" />
          {t.step(run.step, stepIndex(run))}
        </p>
      )}
      <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <GitBranch aria-hidden className="size-3.5" />
        {workspaceText(run)}
      </p>
      <Files run={run} />
      <Exports run={run} />
      {overlaps.length > 0 && (
        <ul className="grid gap-2">
          {overlaps.map((o) => (
            <OverlapRow key={o.id} overlap={o} now={now} onSeeFiles={onSeeFiles} />
          ))}
        </ul>
      )}
      <Button size="sm" variant="outline" className="w-fit" onClick={() => onSeeWork(run.runId)}>
        <Eye aria-hidden />
        {t.seeWork}
      </Button>
    </li>
  );
}
