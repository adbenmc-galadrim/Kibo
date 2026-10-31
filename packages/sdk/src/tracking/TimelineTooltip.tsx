import type { DeadlineCellStep } from "@kibo/schema";
import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { trackingFr as t } from "./fr";
import type { CaseTone } from "./timeline-model";

const OPEN_DELAY_MS = 300;

type Props = {
  tone: CaseTone;
  step: DeadlineCellStep;
  feature: string;
  position: number;
  total: number;
  sprint: string | null;
  children: ReactElement;
};

function markOf(tone: CaseTone, step: DeadlineCellStep): string {
  if (step.hold !== null || tone === "hold") return t.tip.hold(step.hold);
  if (tone === "blocked") return t.tip.blocked(step.blockRef);
  if (tone === "review") return t.tip.review(step.pr);
  return t.tip[tone];
}

export function TimelineTipProvider({ children }: { children: ReactNode }) {
  return <TooltipProvider delayDuration={OPEN_DELAY_MS}>{children}</TooltipProvider>;
}

export function TimelineTooltip({ tone, step, feature, position, total, sprint, children }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-[320px] rounded-[6px] text-[12px]">
        <span className="block">
          <span className="font-mono">{step.key}</span> {step.title}
        </span>
        <span className={`block ${tone === "blocked" ? "text-(--tracking-red)" : ""}`}>
          {markOf(tone, step)}
        </span>
        <span className="block opacity-70">{t.tip.context(feature, position, total, sprint)}</span>
      </TooltipContent>
    </Tooltip>
  );
}
