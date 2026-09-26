import { cn } from "@kibo/sdk/lib/utils";
import { Check } from "lucide-react";
import { fr } from "../i18n/fr";
import type { DraftStep } from "./draft-flow";

export function DraftStepper({ current }: { current: DraftStep }) {
  return (
    <ol aria-label={fr.ai.create.title} className="flex flex-wrap gap-2">
      {fr.ai.steps.map((label, i) => {
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
            <span>{fr.ai.stepLabel(n, label)}</span>
          </li>
        );
      })}
    </ol>
  );
}
