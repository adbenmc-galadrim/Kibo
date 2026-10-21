import { cn } from "../lib/utils";
import type { CaseTone, TimelineCase } from "./timeline-model";

export const CASE_BG: Record<CaseTone, string> = {
  done: "bg-(--tracking-fg)",
  review: "bg-(--tracking-purple)",
  progress: "bg-(--tracking-blue)",
  blocked: "bg-(--tracking-red)",
  hold: "bg-(--tracking-hold)",
  todo: "bg-(--tracking-border)",
};
export const SLIPPED_CASE = "border border-(--tracking-red) bg-(--tracking-red-soft)";

export function StepCases({ cases, y }: { cases: readonly TimelineCase[]; y: number }) {
  return cases.map((c, i) => (
    <span
      key={`${c.slipped ? "s" : "p"}${i}`}
      data-tone={c.slipped ? "slipped" : c.tone}
      className={cn("absolute h-[12px] rounded-[2px]", c.slipped ? SLIPPED_CASE : CASE_BG[c.tone])}
      style={{ left: c.x, top: y + 10, width: c.width }}
    />
  ));
}
