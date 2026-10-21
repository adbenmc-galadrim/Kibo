import { cn } from "@kibo/sdk/lib/utils";
import { CASE_BG } from "@kibo/sdk/tracking";
import type { StepCase } from "./planning-model";

const INNER_WIDTH = 170;
const GAP = 3;

export const caseWidth = (count: number): number =>
  Math.max(2, Math.floor((INNER_WIDTH - GAP * (count - 1)) / Math.max(1, count)));

export function StepCases({ steps }: { steps: readonly StepCase[] }) {
  const width = caseWidth(steps.length);
  return (
    <div data-slot="step-cases" className="flex h-2 items-center gap-[3px]">
      {steps.map((s) => (
        <span
          key={s.ticketId}
          data-tone={s.tone}
          title={s.key}
          className={cn("h-2 shrink-0 rounded-[2px]", CASE_BG[s.tone])}
          style={{ width }}
        />
      ))}
    </div>
  );
}
