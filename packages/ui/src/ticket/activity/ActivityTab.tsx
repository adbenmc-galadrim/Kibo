import {
  type FileRef,
  latestReport,
  type ProjectSnapshot,
  type RunMoment,
  type RunMomentsPage,
  type RunReport,
  type RunView,
  reportOfRun,
  type TicketProgress,
  type TicketView,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { useState } from "react";
import type { ShownPlan } from "../../agents/dock/DockPlan";
import { frMoments } from "../../i18n/fr-moments";
import { ReportCard } from "../../moments/ReportCard";
import { RunSkillReviews } from "../../moments/SkillReviewsBlock";
import { OverlapCounts } from "../../overlaps/OverlapCounts";
import { useAgentsState } from "../../state/agents-context";
import { useNow } from "../../state/use-agents";
import { ChronologyStacked } from "./ChronologyStacked";
import { ChronologyWide } from "./ChronologyWide";
import type { RunEntry } from "./RunSection";
import { ACTIVITY_PAGE, buildTimeline, segmentsOf, ticketRuns, WIDE_ACTIVITY_MIN } from "./timeline";
import { useContainerWidth } from "./use-container-width";
import { useRunsMoments } from "./use-runs-moments";

type Props = { project: ProjectSnapshot; ticket: TicketView; onOpenFile(ref: FileRef): void };

function activityPlan(
  progress: TicketProgress,
  runs: readonly RunView[],
  pages: ReadonlyMap<string, RunMomentsPage>,
): ShownPlan {
  if (progress.plan.length > 0) return { plan: progress.plan, internal: false };
  const internal = [...runs]
    .reverse()
    .map((r) => pages.get(r.id)?.internalPlan)
    .find((p) => p && p.length > 0);
  return internal ? { plan: internal, internal: true } : { plan: [], internal: false };
}

type HeadProps = { report: RunReport | null; runs: readonly RunView[]; overlapRuns: readonly string[] };

function ReportHead({ report, runs, overlapRuns }: HeadProps) {
  const t = frMoments.activity;
  const index = report ? runs.findIndex((r) => r.id === report.runId) : -1;
  const run = runs[index];
  return (
    <div className="grid gap-2">
      <h3 className="flex items-center gap-2 text-sm">
        <span className="font-semibold">{t.report}</span>
        {run && <span className="text-xs text-muted-foreground">{`${t.run(index + 1)} · ${run.label}`}</span>}
      </h3>
      <ReportCard report={report} />
      <OverlapCounts runIds={overlapRuns} />
    </div>
  );
}

const withOverlaps = (runs: readonly RunView[], moments: ReadonlyMap<string, RunMoment[]>): string[] =>
  runs.flatMap((r) => ((moments.get(r.id) ?? []).some((m) => m.data.kind === "overlap") ? [r.id] : []));

export function ActivityTab({ project, ticket, onOpenFile }: Props) {
  const agents = useAgentsState();
  const now = useNow(60_000);
  const [limit, setLimit] = useState(ACTIVITY_PAGE);
  const { ref, width } = useContainerWidth<HTMLDivElement>();
  const runs = ticketRuns(agents?.runs ?? [], ticket.id);
  const shown = runs.slice(-limit);
  const { pages, error } = useRunsMoments(shown.map((r) => r.id));
  const from = runs.length > shown.length ? (shown[0]?.startedAt ?? shown[0]?.createdAt ?? 0) : -Infinity;
  const questions = project.questions.filter((q) => q.ticketId === ticket.id && q.createdAt >= from);
  const momentsByRun = new Map([...pages].map(([id, page]) => [id, page.moments]));
  const segments = segmentsOf(buildTimeline(shown, momentsByRun, questions));
  const last = runs.at(-1);
  const entries: RunEntry[] = segments
    .flatMap((s) => (s.run ? [{ run: s.run, items: s.items }] : []))
    .map(({ run, items }) => ({
      run,
      items,
      index: runs.indexOf(run) + 1,
      report: reportOfRun(ticket.agentProgress, run.id),
    }))
    .reverse();
  const props = {
    entries,
    leading: segments.find((s) => s.run === null)?.items ?? [],
    plan: activityPlan(ticket.agentProgress, shown, pages),
    moments: [...momentsByRun.values()].flat().filter((m) => m.data.kind !== "reasoning"),
    now,
    onOpenFile,
  };
  return (
    <div ref={ref} className="grid grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-6">
      <ReportHead
        report={latestReport(ticket.agentProgress)}
        runs={runs}
        overlapRuns={withOverlaps(shown, momentsByRun)}
      />
      {last && <RunSkillReviews runId={last.id} moments={momentsByRun.get(last.id) ?? []} />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {frMoments.activity.unavailable}
        </p>
      )}
      {width >= WIDE_ACTIVITY_MIN ? <ChronologyWide {...props} /> : <ChronologyStacked {...props} />}
      {runs.length > shown.length && (
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setLimit((n) => n + ACTIVITY_PAGE)}
        >
          {frMoments.activity.older}
        </Button>
      )}
    </div>
  );
}
