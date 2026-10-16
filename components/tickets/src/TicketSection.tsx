import { cn } from "@kibo/sdk/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@kibo/sdk/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { ROW } from "./columns";
import { fr } from "./fr";

type Props = {
  label: string;
  count: number;
  open: boolean;
  onOpenChange(open: boolean): void;
  done?: boolean;
  children: ReactNode;
};

export function TicketSection({ label, count, open, onOpenChange, done = false, children }: Props) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} asChild>
      <li>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-label={open ? fr.collapse(label) : fr.expand(label)}
            className={cn(
              ROW,
              "h-[33px] w-full gap-2 border-t border-(--tracking-soft) bg-(--tracking-panel) text-left",
            )}
          >
            <Chevron aria-hidden className="size-[13px] shrink-0 text-(--tracking-dim)" />
            {done && <span aria-hidden className="size-2 shrink-0 rounded-full bg-(--tracking-green)" />}
            <span className="text-[12px] leading-[1.2] font-medium text-(--tracking-mfg)">{label}</span>
            <span className="font-mono text-[11px] leading-[1.2] text-(--tracking-dim)">{count}</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <ul>{children}</ul>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}
