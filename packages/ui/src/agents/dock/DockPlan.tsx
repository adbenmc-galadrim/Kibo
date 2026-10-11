import { doingStep, type RunMoment, type Step, type TicketProgress } from "@kibo/schema";
import { ListChecks } from "lucide-react";
import { frMoments } from "../../i18n/fr-moments";
import { PlanSteps } from "../../moments/PlanSteps";

export type ShownPlan = { plan: Step[]; internal: boolean };

export function shownPlan(
  progress: TicketProgress | null,
  runId: string,
  internal: Step[] | null,
): ShownPlan {
  const shared = progress?.plan ?? [];
  if (shared.length > 0 && progress?.planRunId === runId) return { plan: shared, internal: false };
  if (internal && internal.length > 0) return { plan: internal, internal: true };
  return { plan: shared, internal: false };
}

function momentCounts(moments: readonly RunMoment[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of moments) if (m.stepId) counts.set(m.stepId, (counts.get(m.stepId) ?? 0) + 1);
  return counts;
}

type Props = {
  shown: ShownPlan;
  moments: readonly RunMoment[];
  current: string | null;
  onStep(stepId: string): void;
};

export function DockPlan({ shown, moments, current, onStep }: Props) {
  const t = frMoments.plan;
  const doing = doingStep(shown.plan);
  const position = doing
    ? shown.plan.indexOf(doing) + 1
    : shown.plan.filter((s) => s.status === "done").length;
  return (
    <div className="grid content-start gap-2">
      <div className="flex items-center gap-2 text-sm">
        <ListChecks aria-hidden className="size-4" />
        <span className="font-semibold">{t.title}</span>
        {shown.plan.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            {t.progress(position, shown.plan.length)}
          </span>
        )}
        <span className="flex-1" />
        {shown.plan.length > 0 && !shown.internal && (
          <span className="font-mono text-[11px] text-muted-foreground">{t.shared}</span>
        )}
      </div>
      {shown.plan.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.empty}</p>
      ) : (
        <PlanSteps
          plan={shown.plan}
          internal={shown.internal}
          onStep={onStep}
          current={current}
          momentCounts={momentCounts(moments)}
        />
      )}
    </div>
  );
}
