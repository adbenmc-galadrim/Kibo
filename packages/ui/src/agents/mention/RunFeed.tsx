import type { RunMoment, RunView, Step } from "@kibo/schema";
import { useEffect, useRef } from "react";
import { frMoments } from "../../i18n/fr-moments";
import { Feed } from "../../moments/Feed";
import { useOpenSignal } from "../../moments/use-open-signal";
import { useRunFileContext } from "../../moments/use-run-file-context";
import { useHost } from "../../shell/Host";
import { useRunLog } from "../../state/use-run-log";
import { exchangeOf } from "../dock/exchange";

type Props = {
  run: RunView;
  runs: readonly RunView[];
  moments: RunMoment[];
  steps: Step[];
  showReasoning?: boolean;
  highlightStep?: string | null;
  loading?: boolean;
  failed?: boolean;
};

export function RunFeed(props: Props) {
  if (props.failed)
    return (
      <p role="alert" className="text-sm text-destructive">
        {frMoments.run.failed}
      </p>
    );
  if (props.loading) return <p className="text-xs text-muted-foreground">{frMoments.run.loading}</p>;
  return <LoadedFeed {...props} />;
}

function LoadedFeed({ run, runs, moments, steps, showReasoning = false, highlightStep = null }: Props) {
  const host = useHost();
  const files = useRunFileContext(run);
  const openSignal = useOpenSignal();
  const { log } = useRunLog(run.id);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlightStep) return;
    const items = ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>("[data-step]")) : [];
    items.find((el) => el.dataset.step === highlightStep)?.scrollIntoView({ block: "start" });
  }, [highlightStep]);
  return (
    <div ref={ref} className="grid content-start gap-3">
      <Feed
        moments={moments}
        extras={exchangeOf(log, runs)}
        steps={steps}
        files={files}
        showReasoning={showReasoning}
        highlightStep={highlightStep}
        onOpenFile={host.openFile}
        onOpenSignal={openSignal}
        label={run.label}
        texts={frMoments}
      />
    </div>
  );
}
