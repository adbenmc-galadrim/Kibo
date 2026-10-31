import { cn } from "../lib/utils";
import { TimelineTooltip } from "./TimelineTooltip";
import type { CaseTone, TimelineRow } from "./timeline-model";

export const CASE_BG: Record<CaseTone, string> = {
  done: "bg-(--tracking-fg)",
  review: "bg-(--tracking-purple)",
  progress: "bg-(--tracking-blue)",
  blocked: "bg-(--tracking-red)",
  hold: "bg-(--tracking-hold)",
  todo: "bg-(--tracking-border)",
};
const SLIPPED_CASE = "border border-(--tracking-red) bg-(--tracking-red-soft)";

export function StepCases({ row, sprint }: { row: TimelineRow; sprint: string | null }) {
  const planned = row.row.cells.filter((c) => !c.slipped).length;
  return row.cases.map((c, i) => {
    const square = (
      <span
        key={`${c.slipped ? "s" : "p"}${i}`}
        data-tone={c.slipped ? "slipped" : c.tone}
        className={cn("absolute h-[12px] rounded-[2px]", c.slipped ? SLIPPED_CASE : CASE_BG[c.tone])}
        style={{ left: c.x, top: row.y + 10, width: c.width }}
      />
    );
    if (c.step === undefined) return square;
    const position = row.row.cells.findIndex((cell) => cell.step?.key === c.step?.key) + 1;
    return (
      <TimelineTooltip
        key={`${c.slipped ? "s" : "p"}${i}`}
        tone={c.tone}
        step={c.step}
        feature={`${row.row.shortKey} ${row.row.title}`}
        position={position}
        total={planned}
        sprint={sprint}
      >
        {square}
      </TimelineTooltip>
    );
  });
}
