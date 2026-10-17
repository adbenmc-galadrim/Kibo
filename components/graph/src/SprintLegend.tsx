import { cn } from "@kibo/sdk/lib/utils";
import { CalendarRange } from "lucide-react";
import type { ReactNode } from "react";
import { RING_CLASS } from "./FrameStepRow";
import { fr } from "./fr";

const DOT = "size-2 shrink-0 rounded-full";

const ITEMS: readonly [string, ReactNode][] = [
  [fr.sprints.legend.todo, <span key="todo" className={cn("size-2 shrink-0", RING_CLASS)} />],
  [fr.sprints.legend.progress, <span key="progress" className={cn(DOT, "bg-(--tracking-blue)")} />],
  [fr.sprints.legend.review, <span key="review" className={cn(DOT, "bg-(--tracking-purple)")} />],
  [fr.sprints.legend.blocked, <span key="blocked" className={cn(DOT, "bg-(--tracking-red)")} />],
  [
    fr.sprints.legend.feature,
    <svg key="feature" aria-hidden="true" width={14} height={10} className="shrink-0">
      <rect
        x={0.5}
        y={0.5}
        width={13}
        height={9}
        rx={2.5}
        fill="none"
        stroke="var(--tracking-mfg)"
        strokeDasharray="3 2"
      />
    </svg>,
  ],
  [
    fr.sprints.legend.column,
    <CalendarRange key="column" size={12} absoluteStrokeWidth className="shrink-0 text-(--tracking-mfg)" />,
  ],
  [
    fr.sprints.legend.session,
    <span key="session" className="size-[7px] shrink-0 rounded-full bg-(--tracking-brand)" />,
  ],
];

export function SprintLegend() {
  return (
    <ul
      aria-label={fr.sprints.legend.label}
      className="pointer-events-none absolute bottom-[18px] left-4 flex h-[30px] items-center gap-3.5 rounded-[8px] border border-(--tracking-border) bg-(--tracking-card) px-3"
    >
      {ITEMS.map(([label, mark]) => (
        <li
          key={label}
          className="flex items-center gap-1.5 text-(--tracking-mfg) text-[11.5px] leading-[14px]"
        >
          <span aria-hidden className="contents">
            {mark}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}
