import { cn } from "@kibo/sdk/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { ROW } from "./columns";
import { fr } from "./fr";

type More = { all: boolean; recent: number; onToggle(): void };

type Props = {
  label: string;
  count: number;
  open: boolean;
  onOpenChange(open: boolean): void;
  more?: More | null;
  done?: boolean;
  children: ReactNode;
};

const COUNT = "font-mono text-[11px] leading-[1.2] text-(--tracking-dim)";

export function TicketSection({
  label,
  count,
  open,
  onOpenChange,
  more = null,
  done = false,
  children,
}: Props) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <li>
        <div className={cn(ROW, "h-[33px] gap-2 border-t border-(--tracking-soft) bg-(--tracking-panel)")}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              aria-label={open ? fr.collapse(label) : fr.expand(label)}
              className="flex items-center gap-2 text-left"
            >
              <Chevron aria-hidden className="size-[13px] shrink-0 text-(--tracking-dim)" />
              {done && <span aria-hidden className="size-2 shrink-0 rounded-full bg-(--tracking-green)" />}
              <span className="text-[12px] leading-[1.2] font-medium text-(--tracking-mfg)">{label}</span>
            </button>
          </CollapsibleTrigger>
          {more && open ? (
            <button
              type="button"
              aria-label={more.all ? fr.showRecent(more.recent) : fr.showAll(count)}
              aria-pressed={more.all}
              className={cn(COUNT, "rounded-[4px] hover:text-(--tracking-fg) hover:underline")}
              onClick={more.onToggle}
            >
              {count}
            </button>
          ) : (
            <span className={COUNT}>{count}</span>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="h-full flex-1"
            onClick={() => onOpenChange(!open)}
          />
        </div>
        <CollapsibleContent asChild>
          <ul>{children}</ul>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}
