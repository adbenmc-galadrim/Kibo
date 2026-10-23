import { Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "../lib/utils";
import { trackingFr as t } from "./fr";

export type LegendEntry = { key: string; label: string; mark: ReactNode; separator?: true };

type Props = { items: readonly LegendEntry[]; className?: string };

export function LegendToggle({ items, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        aria-label={t.legendLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto grid size-5 shrink-0 place-items-center rounded-[5px] text-(--tracking-dim) outline-none hover:bg-(--tracking-hover) focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info size={13} absoluteStrokeWidth />
      </button>
      {open && (
        <ul aria-label={t.legendLabel} className="flex items-center gap-3.5">
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
