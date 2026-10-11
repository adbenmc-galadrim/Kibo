import { useId } from "react";
import { frMoments } from "../../i18n/fr-moments";
import { type ChronologyProps, LeadingFeed, PlanBlock, useStepFocus } from "./ChronologyWide";
import { RunSection } from "./RunSection";

export function ChronologyStacked({ entries, leading, plan, moments, now, onOpenFile }: ChronologyProps) {
  const { ref, step, pick } = useStepFocus();
  const heading = useId();
  const t = frMoments.activity;
  const options = { steps: plan.plan, highlightStep: step, onOpenFile };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <PlanBlock plan={plan} moments={moments} step={step} onStep={pick} />
      <section
        ref={ref}
        aria-labelledby={heading}
        className="grid grid-cols-[minmax(0,1fr)] content-start gap-2"
      >
        <h3 id={heading} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t.runs}
        </h3>
        {entries.length === 0 && <p className="text-sm text-muted-foreground">{t.noRuns}</p>}
        {entries.map((entry, i) => (
          <RunSection key={entry.run.id} entry={entry} now={now} defaultOpen={i === 0} options={options} />
        ))}
        <LeadingFeed items={leading} />
      </section>
    </div>
  );
}
