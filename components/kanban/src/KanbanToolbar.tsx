import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Toggle } from "@kibo/sdk/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { ChevronDown, ListFilter } from "lucide-react";
import type { ReactNode } from "react";
import { type KanbanFilter, LABEL_ALL } from "./filter";
import { fr } from "./fr";

type Props = {
  filter: KanbanFilter;
  onFilter: (filter: KanbanFilter) => void;
  label: string | null;
  labels: readonly string[];
  onLabel: (label: string | null) => void;
  startable: boolean;
  onStartable: (startable: boolean) => void;
  onShowAll: () => void;
  shown: number;
  total: number;
  children?: ReactNode;
};

const FILTERS: { value: KanbanFilter; label: string }[] = [
  { value: "mine-and-agents", label: fr.filter.mineAndAgents },
  { value: "all", label: fr.filter.all },
];

const isFilter = (value: string): value is KanbanFilter => FILTERS.some((f) => f.value === value);

type LabelMenuProps = Pick<Props, "label" | "labels" | "onLabel">;

function LabelMenu({ label, labels, onLabel }: LabelMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          title={fr.labelFilter.label}
          disabled={labels.length === 0 && label === null}
          className="h-7 shrink-0 gap-1 px-2.5 text-xs font-normal"
        >
          {label === null ? fr.labelFilter.all : fr.labelFilter.one(label)}
          <ChevronDown absoluteStrokeWidth size={14} aria-hidden className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={label ?? LABEL_ALL}
          onValueChange={(value) => onLabel(value === LABEL_ALL ? null : value)}
        >
          <DropdownMenuRadioItem value={LABEL_ALL} className="text-xs">
            {fr.labelFilter.all}
          </DropdownMenuRadioItem>
          {labels.length > 0 && <DropdownMenuSeparator />}
          {labels.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} className="font-mono text-xs">
              {l}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function KanbanToolbar(props: Props) {
  const { filter, onFilter, label, startable, onShowAll, shown, total, children } = props;
  const filterLabel = FILTERS.find((f) => f.value === filter)?.label ?? "";
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
      <LabelMenu label={label} labels={props.labels} onLabel={props.onLabel} />
      <Toggle
        variant="outline"
        size="sm"
        pressed={startable}
        onPressedChange={props.onStartable}
        className="h-7 shrink-0 gap-1 px-2.5 text-xs font-normal"
      >
        <ListFilter absoluteStrokeWidth size={14} aria-hidden className="size-3.5" />
        {fr.startableFilter}
      </Toggle>
      {children}
      <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
        {fr.counter(shown, total, filterLabel)}
      </span>
      {(filter !== "all" || label !== null || startable) && hidden > 0 && (
        <Button size="sm" variant="link" className="h-auto shrink-0 px-0 text-xs" onClick={onShowAll}>
          {fr.hidden(hidden)}
        </Button>
      )}
    </header>
  );
}
