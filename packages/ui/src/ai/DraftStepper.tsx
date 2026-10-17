import type { ComponentDraft } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Check } from "lucide-react";
import { frAi } from "../i18n/fr-ai";
import type { DraftStep } from "./draft-flow";

type Props = { current: DraftStep; mode?: ComponentDraft["mode"] };

export function DraftStepper({ current, mode = "create" }: Props) {
  const steps = mode === "modify" ? frAi.ai.steps.slice(0, 4) : frAi.ai.steps;
  return (
    <ol aria-label={frAi.ai.create.title} className="flex flex-wrap gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        return (
          <li
            key={label}
            aria-current={n === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
              n === current
                ? "border-foreground/40 bg-accent font-medium text-foreground"
                : n < current
                  ? "border-transparent text-foreground"
                  : "border-transparent text-muted-foreground",
            )}
          >
            {n < current && <Check aria-hidden className="size-3 text-emerald-600 dark:text-emerald-400" />}
            <span>{frAi.ai.stepLabel(n, label)}</span>
          </li>
        );
      })}
    </ol>
  );
}
