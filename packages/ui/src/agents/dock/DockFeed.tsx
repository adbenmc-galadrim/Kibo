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
import { useRunFileContext } from "../../moments/use-run-file-context";
import { RunDetail } from "../RunDetail";
import { useFollowBottom } from "../use-follow-bottom";

type Props = {
  run: RunView;
  resumable: boolean;
  questions: Parameters<typeof RunDetail>[0]["questions"];
  now: number;
  moments: RunMoment[];
  steps: Step[];
  report: RunReport | null;
  highlightStep: string | null;
  onOpenFile(ref: FileRef): void;
};

export function DockFeed({
  run,
  resumable,
  questions,
  now,
  moments,
  steps,
  report,
  highlightStep,
  onOpenFile,
}: Props) {
  const files = useRunFileContext(run);
  const { ref, onScroll, release } = useFollowBottom<HTMLDivElement>(moments.length);
  useEffect(() => {
    if (!highlightStep) return;
    const steps = ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>("[data-step]")) : [];
    const first = steps.find((el) => el.dataset.step === highlightStep);
    if (!first) return;
    release();
    first.scrollIntoView({ block: "start" });
  }, [highlightStep, ref, release]);
  return (
    <RunDetail run={run} resumable={resumable} questions={questions} now={now}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1"
      >
        <Feed
          moments={moments}
          steps={steps}
          highlightStep={highlightStep}
          files={files}
          onOpenFile={onOpenFile}
          label={run.label}
          texts={frMoments}
        />
        {isTerminal(run.state) && <ReportCard report={report} />}
      </div>
    </RunDetail>
  );
}
