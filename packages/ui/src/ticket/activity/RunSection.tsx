import {
  type FileRef,
  isTerminal,
  type RunReport,
  type RunState,
  type RunView,
  type Step,
} from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { formatClock } from "../../agents/format";
import { frAgentBar } from "../../i18n/fr-agent-bar";
import { frMoments } from "../../i18n/fr-moments";
import { Feed } from "../../moments/Feed";
import { useOpenSignal } from "../../moments/use-open-signal";
import { useRunFileContext } from "../../moments/use-run-file-context";
import { OverlapFeedLayer } from "../../overlaps/OverlapFeedLayer";
import { useOpenOverlap } from "../../overlaps/use-open-overlap";
import { questionExtras, type TimelineItem } from "./timeline";

export type RunEntry = { run: RunView; index: number; report: RunReport | null; items: TimelineItem[] };

type FeedOptions = { steps: Step[]; highlightStep: string | null; onOpenFile(ref: FileRef): void };

const DAY = 86_400_000;

const DOT: Record<RunState, string> = {
  queued: "bg-zinc-400",
  starting: "bg-blue-600 dark:bg-blue-500",
  running: "bg-blue-600 dark:bg-blue-500",
  waiting_input: "bg-brand",
  done: "bg-green-600 dark:bg-green-500",
  failed: "bg-red-600 dark:bg-red-500",
  cancelled: "bg-red-600 dark:bg-red-500",
};

const startOfDay = (at: number): number => new Date(at).setHours(0, 0, 0, 0);

function dayText(at: number, now: number): string {
  const t = frMoments.activity;
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days === 0) return t.today(formatClock(at));
  if (days === 1) return t.yesterday(formatClock(at));
  const date = new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${date} ${formatClock(at)}`;
}

function spanText(run: RunView, now: number): string {
  const start = run.startedAt ?? run.createdAt;
  if (run.endedAt === null) return dayText(start, now);
  return frMoments.activity.span(dayText(start, now), formatClock(run.endedAt));
}

const capitalized = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function outcomeText(run: RunView, report: RunReport | null): string {
  const state = frAgentBar.states[run.state];
  if (!isTerminal(run.state)) return state;
  if (!report) return `${state} · ${frMoments.report.none}`;
  const undeclared = report.check?.undeclared.length ?? 0;
  return capitalized(frMoments.dock.reportLine(report.toCheck.length, undeclared));
}

export function RunHeading({ entry, now }: { entry: RunEntry; now: number }) {
  const { run, index, report } = entry;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[run.state])} />
      <span className="font-semibold">{frMoments.activity.run(index)}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">{run.label}</span>
      <span className="truncate text-xs text-muted-foreground">{spanText(run, now)}</span>
      <span
        className={cn(
          "ml-auto truncate text-right text-xs",
          run.state === "waiting_input" ? "text-brand-strong dark:text-brand" : "text-muted-foreground",
        )}
      >
        {outcomeText(run, report)}
      </span>
    </span>
  );
}

export function RunFeed({ entry, options }: { entry: RunEntry; options: FeedOptions }) {
  const files = useRunFileContext(entry.run);
  const openSignal = useOpenSignal(entry.run.projectId);
  const moments = entry.items.flatMap((i) => (i.moment ? [i.moment] : []));
  const overlap = useOpenOverlap(entry.run, moments);
  const extras = questionExtras(entry.items);
  if (moments.length === 0 && extras.length === 0 && isTerminal(entry.run.state)) return null;
  return (
    <>
      <Feed
        moments={moments}
        extras={extras}
        steps={options.steps}
        highlightStep={options.highlightStep}
        files={files}
        onOpenFile={options.onOpenFile}
        onOpenSignal={openSignal}
        {...overlap.feed}
        texts={frMoments}
      />
      <OverlapFeedLayer filesId={overlap.filesId} failed={overlap.failed} onClose={overlap.closeFiles} />
    </>
  );
}

type SectionProps = { entry: RunEntry; now: number; defaultOpen: boolean; options: FeedOptions };

export function RunSection({ entry, now, defaultOpen, options }: SectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-accent">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
        />
        <RunHeading entry={entry} now={now} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-7">
        <RunFeed entry={entry} options={options} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export type { FeedOptions };
