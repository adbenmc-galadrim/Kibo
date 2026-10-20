import { cn } from "@kibo/sdk/lib/utils";
import { Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import { fr } from "./fr";

export type LegendItem = { key: string; label: string; mark: ReactNode; separator?: true };

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

export function GraphLegend({ items }: { items: readonly LegendItem[] }) {
  const [open, setOpen] = useState(readOpen);
  const toggle = () => {
    writeOpen(!open);
    setOpen(!open);
  };
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-[18px] left-4 flex h-[30px] max-w-[calc(100%-2rem)] items-center overflow-hidden gap-3 rounded-[8px] border border-(--tracking-border) bg-(--tracking-card) pl-1.5",
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
          {items.map((item) => (
            <li
              key={item.key}
              data-separator={item.separator ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap text-(--tracking-mfg) text-[11.5px] leading-[14px]",
                item.separator && "border-(--tracking-border) border-l pl-3.5",
              )}
            >
              <span aria-hidden className="contents">
                {item.mark}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
