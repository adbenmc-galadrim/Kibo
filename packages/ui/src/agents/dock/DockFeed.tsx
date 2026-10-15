import {
  type FileRef,
  isTerminal,
  type RunMoment,
  type RunReport,
  type RunView,
  type Step,
} from "@kibo/schema";
import { useEffect } from "react";
import { frMoments } from "../../i18n/fr-moments";
import { Feed } from "../../moments/Feed";
import { ReportCard } from "../../moments/ReportCard";
import { subagentItem } from "../../moments/subagent-item";
import { useOpenSignal } from "../../moments/use-open-signal";
import { useRunFileContext } from "../../moments/use-run-file-context";
import { useRunSubagents } from "../../moments/use-run-subagents";
import { OverlapFeedLayer } from "../../overlaps/OverlapFeedLayer";
import { useOpenOverlap } from "../../overlaps/use-open-overlap";
import { useRunLog } from "../../state/use-run-log";
import type { JournalRun } from "../journal-runs";
import { RunDetail } from "../RunDetail";
import { useFollowBottom } from "../use-follow-bottom";
import { exchangeOf } from "./exchange";

type Props = {
  run: RunView;
  resumable: boolean;
  questions: Parameters<typeof RunDetail>[0]["questions"];
  now: number;
  moments: RunMoment[];
  runs: readonly JournalRun[];
  steps: Step[];
  report: RunReport | null;
  highlightStep: string | null;
  focusSubagent?: string | null;
  onOpenFile(ref: FileRef): void;
};

export function DockFeed({
  run,
  resumable,
  questions,
  now,
  moments,
  runs,
  steps,
  report,
  highlightStep,
  focusSubagent = null,
  onOpenFile,
}: Props) {
  const files = useRunFileContext(run);
  const openSignal = useOpenSignal(run.projectId);
  const { log } = useRunLog(run.id);
  const overlap = useOpenOverlap(run, moments);
  const subagents = useRunSubagents(run.id, moments);
  const extras = exchangeOf(log, runs);
  const { ref, onScroll, release } = useFollowBottom<HTMLDivElement>(moments.length + extras.length);
  useEffect(() => {
    if (!highlightStep) return;
    const steps = ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>("[data-step]")) : [];
    const first = steps.find((el) => el.dataset.step === highlightStep);
    if (!first) return;
    release();
    first.scrollIntoView({ block: "start" });
  }, [highlightStep, ref, release]);
  const focused = focusSubagent !== null && subagents.byId.has(focusSubagent);
  useEffect(() => {
    if (!focused || focusSubagent === null) return;
    const item = subagentItem(ref.current, focusSubagent);
    if (!item) return;
    release();
    item.scrollIntoView({ block: "start" });
  }, [focused, focusSubagent, ref, release]);
  return (
    <RunDetail run={run} resumable={resumable} questions={questions} now={now}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-y-auto pr-1"
      >
        <Feed
          moments={moments}
          extras={extras}
          steps={steps}
          highlightStep={highlightStep}
          files={files}
          onOpenFile={onOpenFile}
          onOpenSignal={openSignal}
          {...overlap.feed}
          subagents={subagents.byId}
          label={run.label}
          texts={frMoments}
        />
        <OverlapFeedLayer filesId={overlap.filesId} failed={overlap.failed} onClose={overlap.closeFiles} />
        {isTerminal(run.state) && <ReportCard report={report} />}
      </div>
    </RunDetail>
  );
}
