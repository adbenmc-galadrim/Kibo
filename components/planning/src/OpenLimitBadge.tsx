import { cn } from "@kibo/sdk/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown, Target } from "lucide-react";
import { fr } from "./fr";
import type { FeatureCard } from "./planning-model";

type Props = {
  open: number;
  limit: number;
  over: boolean;
  cards: readonly FeatureCard[];
  onOpen(id: string): void;
};

export function OpenLimitBadge({ open, limit, over, cards, onOpen }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-over={over}
          className={cn(
            "flex h-[25px] items-center gap-1.5 rounded-[6px] border px-[9px] font-medium text-[12.5px] leading-[15px]",
            over
              ? "border-(--tracking-amber) text-(--tracking-amber)"
              : "border-(--tracking-border) text-(--tracking-fg)",
          )}
        >
          <Target absoluteStrokeWidth size={13} aria-hidden className="text-(--tracking-amber)" />
          {fr.open(open, limit)}
          <ChevronDown absoluteStrokeWidth size={12} aria-hidden className="text-(--tracking-dim)" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{fr.openMenu}</DropdownMenuLabel>
        {cards.length === 0 && <DropdownMenuItem disabled>{fr.openNone}</DropdownMenuItem>}
        {cards.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onOpen(c.id)}>
            <span className="font-mono text-muted-foreground text-xs">{c.shortKey}</span>
            <span className="truncate">{c.title}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-muted-foreground text-xs">{fr.openHelp}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
