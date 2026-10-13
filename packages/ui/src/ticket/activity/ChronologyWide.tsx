import type { FileRef, RunMoment } from "@kibo/schema";
import { ScrollPane } from "@kibo/sdk/ui/scroll-pane";
import { useCallback, useRef, useState } from "react";
import { DockPlan, type ShownPlan } from "../../agents/dock/DockPlan";
import { frMoments } from "../../i18n/fr-moments";
import { Feed } from "../../moments/Feed";
import { type RunEntry, RunFeed, RunHeading } from "./RunSection";
import { questionExtras, type TimelineItem } from "./timeline";

export type ChronologyProps = {
  entries: RunEntry[];
  leading: TimelineItem[];
  plan: ShownPlan;
  moments: RunMoment[];
  now: number;
  onOpenFile(ref: FileRef): void;
};

export function useStepFocus() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState<string | null>(null);
  const pick = useCallback((id: string) => {
    setStep(id);
    const marked = ref.current ? Array.from(ref.current.querySelectorAll<HTMLElement>("[data-step]")) : [];
    marked.find((el) => el.dataset.step === id)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);
  return { ref, step, pick };
}

export function PlanBlock({
  plan,
  moments,
  step,
  onStep,
  className,
}: {
  plan: ShownPlan;
  moments: RunMoment[];
  step: string | null;
  onStep(id: string): void;
  className?: string;
}) {
  return (
    <section aria-label={frMoments.plan.title} className={className}>
      <DockPlan shown={plan} moments={moments} current={step} onStep={onStep} />
    </section>
  );
}

export function LeadingFeed({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return null;
  return <Feed moments={[]} extras={questionExtras(items)} texts={frMoments} />;
}

export function ChronologyWide({ entries, leading, plan, moments, now, onOpenFile }: ChronologyProps) {
  const { ref, step, pick } = useStepFocus();
  const t = frMoments.activity;
  const options = { steps: plan.plan, highlightStep: step, onOpenFile };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-6">
      <section
        ref={ref}
        aria-label={t.chronology}
        className="grid grid-cols-[minmax(0,1fr)] content-start gap-4"
      >
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {`${t.chronology} · ${t.mixed}`}
        </h3>
        {entries.length === 0 && <p className="text-sm text-muted-foreground">{t.noRuns}</p>}
        {entries.map((entry) => (
          <article key={entry.run.id} className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <h4 className="flex">
              <RunHeading entry={entry} now={now} />
            </h4>
            <div className="border-l pl-4">
              <RunFeed entry={entry} options={options} />
            </div>
          </article>
        ))}
        <LeadingFeed items={leading} />
      </section>
      <ScrollPane className="sticky top-0 max-h-[calc(100dvh-var(--shell-top)-3rem)] rounded-lg border p-3">
        <PlanBlock plan={plan} moments={moments} step={step} onStep={pick} />
      </ScrollPane>
    </div>
  );
}
