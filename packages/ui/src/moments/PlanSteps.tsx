import type { Step, StepStatus } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Circle, CircleCheck, CircleX, LoaderCircle } from "lucide-react";
import { frMoments } from "../i18n/fr-moments";

type Props = {
  plan: Step[];
  internal: boolean;
  onStep?(stepId: string): void;
  momentCounts?: ReadonlyMap<string, number>;
  current?: string | null;
};

const ICON: Record<StepStatus, { icon: typeof Circle; tone: string }> = {
  todo: { icon: Circle, tone: "text-muted-foreground" },
  doing: { icon: LoaderCircle, tone: "text-blue-600 dark:text-blue-500" },
  done: { icon: CircleCheck, tone: "text-green-600 dark:text-green-500" },
  blocked: { icon: CircleX, tone: "text-red-600 dark:text-red-500" },
};

export function PlanSteps({ plan, internal, onStep, momentCounts, current = null }: Props) {
  const t = frMoments.plan;
  return (
    <div className="grid gap-2">
      {internal && <p className="text-xs text-muted-foreground italic">{t.internal}</p>}
      <ol className="grid gap-1">
        {plan.map((step) => {
          const { icon: Icon, tone } = ICON[step.status];
          const count = momentCounts?.get(step.id) ?? 0;
          return (
            <li key={step.id}>
              <button
                type="button"
                data-status={step.status}
                aria-pressed={current === step.id}
                onClick={() => onStep?.(step.id)}
                className={cn(
                  "grid w-full grid-cols-[1rem_1fr] gap-x-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent",
                  current === step.id && "bg-accent",
                )}
              >
                <Icon aria-hidden className={cn("mt-0.5 size-4", tone)} />
                <span>
                  {step.title}
                  <span className="sr-only">{` · ${t.status[step.status]}`}</span>
                </span>
                {step.note && (
                  <span
                    className={cn(
                      "col-start-2 text-xs",
                      step.status === "blocked" ? "text-red-600 dark:text-red-500" : "text-muted-foreground",
                    )}
                  >
                    {step.note}
                  </span>
                )}
                {count > 0 && (
                  <span className="col-start-2 text-xs text-muted-foreground">{`→ ${t.moments(count)}`}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
