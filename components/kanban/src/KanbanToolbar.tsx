import { Button } from "@kibo/sdk/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import type { ReactNode } from "react";
import type { KanbanFilter } from "./filter";
import { fr } from "./fr";

type Props = {
  filter: KanbanFilter;
  onFilter: (filter: KanbanFilter) => void;
  shown: number;
  total: number;
  children?: ReactNode;
};

const FILTERS: { value: KanbanFilter; label: string }[] = [
  { value: "mine-and-agents", label: fr.filter.mineAndAgents },
  { value: "all", label: fr.filter.all },
];

const isFilter = (value: string): value is KanbanFilter => FILTERS.some((f) => f.value === value);

export function KanbanToolbar({ filter, onFilter, shown, total, children }: Props) {
  const label = FILTERS.find((f) => f.value === filter)?.label ?? "";
  const hidden = total - shown;
  return (
    <header className="flex h-10 items-center gap-2 border-b px-3 text-sm">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        aria-label={fr.filter.label}
        value={filter}
        onValueChange={(value) => isFilter(value) && onFilter(value)}
      >
        {FILTERS.map((f) => (
          <ToggleGroupItem key={f.value} value={f.value} className="px-2.5 text-xs">
            {f.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {children}
      <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
        {fr.counter(shown, total, label)}
      </span>
      {filter !== "all" && hidden > 0 && (
        <Button
          size="sm"
          variant="link"
          className="h-auto shrink-0 px-0 text-xs"
          onClick={() => onFilter("all")}
        >
          {fr.hidden(hidden)}
        </Button>
      )}
    </header>
  );
}
