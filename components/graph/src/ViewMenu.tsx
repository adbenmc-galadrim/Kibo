import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Check, SlidersHorizontal } from "lucide-react";
import { fr } from "./fr";

type Props = {
  prefixes: readonly string[];
  groupBy: string | null;
  disabled: boolean;
  onGroupBy(prefix: string | null): void;
  onExpandAll(): void;
  onCollapseAll(): void;
};

const NONE = "";

export function ViewMenu({ prefixes, groupBy, disabled, onGroupBy, onExpandAll, onCollapseAll }: Props) {
  const grouped = groupBy !== null && !disabled;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <SlidersHorizontal aria-hidden="true" />
          {grouped ? fr.viewGrouped(groupBy) : fr.view}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{fr.view}</DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={disabled} className="gap-2">
            <Check aria-hidden="true" className={grouped ? "size-4" : "size-4 opacity-0"} />
            <span className="flex-1">{fr.groupBy}</span>
            {grouped && <span className="text-xs text-muted-foreground">{fr.groupPrefix(groupBy)}</span>}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={groupBy ?? NONE}
              onValueChange={(v) => onGroupBy(v === NONE ? null : v)}
            >
              <DropdownMenuRadioItem value={NONE}>{fr.groupNone}</DropdownMenuRadioItem>
              {prefixes.map((p) => (
                <DropdownMenuRadioItem key={p} value={p}>
                  {fr.groupPrefix(p)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!grouped} onSelect={onExpandAll}>
          {fr.expandAll}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!grouped} onSelect={onCollapseAll}>
          {fr.collapseAll}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
