import { cn } from "@kibo/sdk/lib/utils";
import { CalendarRange } from "lucide-react";
import { RING_CLASS } from "./FrameStepRow";
import { fr } from "./fr";
import type { LegendItem } from "./GraphLegend";

const DOT = "size-2 shrink-0 rounded-full";
const L = fr.sprints.legend;

export const SPRINT_LEGEND: readonly LegendItem[] = [
  { key: "todo", label: L.todo, mark: <span className={cn("size-2 shrink-0", RING_CLASS)} /> },
  { key: "progress", label: L.progress, mark: <span className={cn(DOT, "bg-(--tracking-blue)")} /> },
  { key: "review", label: L.review, mark: <span className={cn(DOT, "bg-(--tracking-purple)")} /> },
  { key: "blocked", label: L.blocked, mark: <span className={cn(DOT, "bg-(--tracking-red)")} /> },
  { key: "hold", label: L.hold, mark: <span className={cn(DOT, "bg-(--tracking-hold)")} /> },
  {
    key: "feature",
    label: L.feature,
    mark: (
      <svg aria-hidden="true" width={14} height={10} className="shrink-0">
        <rect x={0.5} y={0.5} width={13} height={9} rx={2.5} fill="none" stroke="var(--tracking-border)" />
      </svg>
    ),
  },
  {
    key: "ready",
    label: L.ready,
    mark: (
      <span className="h-2.5 w-3.5 shrink-0 rounded-[3px] border border-(--tracking-green) bg-(--tracking-card)" />
    ),
  },
  {
    key: "column",
    label: L.column,
    mark: <CalendarRange size={12} absoluteStrokeWidth className="shrink-0 text-(--tracking-mfg)" />,
  },
  {
    key: "session",
    label: L.session,
    mark: <span className="size-[7px] shrink-0 rounded-full bg-(--tracking-brand)" />,
  },
];
