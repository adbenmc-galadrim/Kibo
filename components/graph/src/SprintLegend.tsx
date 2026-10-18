import { cn } from "@kibo/sdk/lib/utils";
import { CalendarRange, Info } from "lucide-react";
import { type ReactNode, useState } from "react";
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

const LEGEND_KEY = "kibo.graph.legend";

function readOpen(): boolean {
  try {
    return localStorage.getItem(LEGEND_KEY) !== "closed";
  } catch {
    return true;
  }
}

function writeOpen(open: boolean): void {
  try {
    localStorage.setItem(LEGEND_KEY, open ? "open" : "closed");
  } catch (e) {
    console.warn("[graph] legend state not saved", e);
  }
}

export function SprintLegend() {
  const [open, setOpen] = useState(readOpen);
  const toggle = () => {
    writeOpen(!open);
    setOpen(!open);
  };
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-[18px] left-4 flex h-[30px] items-center gap-3 rounded-[8px] border border-(--tracking-border) bg-(--tracking-card) pl-1.5",
        open ? "pr-3" : "pr-1.5",
      )}
    >
      <button
        type="button"
        aria-label={fr.sprints.legend.label}
        aria-expanded={open}
        onClick={toggle}
        className="pointer-events-auto grid size-5 place-items-center rounded-[5px] text-(--tracking-dim) outline-none hover:bg-(--tracking-hover) focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info size={13} absoluteStrokeWidth />
      </button>
      {open && (
        <ul aria-label={fr.sprints.legend.label} className="flex items-center gap-3.5">
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
      )}
    </div>
  );
}
