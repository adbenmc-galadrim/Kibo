import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { ChevronDown, RotateCcw, Tag } from "lucide-react";
import type { ReactNode } from "react";
import { KANBAN_FILTERS, type KanbanFilterKey, LABEL_ALL } from "./filter";
import { fr } from "./fr";

type Props = {
  mine: string | null;
  filters: readonly KanbanFilterKey[];
  onFilters: (filters: readonly KanbanFilterKey[]) => void;
  onClear: () => void;
  total: number;
  counts: Record<KanbanFilterKey, number>;
  sprintCode: string | null;
  label: string | null;
  labels: readonly string[];
  onLabel: (label: string | null) => void;
  onShowAll: () => void;
  shown: number;
  hidden: number;
  children?: ReactNode;
};

const ALL = "all";

const COUNT = "font-mono text-[11px] font-normal text-muted-foreground @max-[36rem]/toolbar:hidden";

const isFilter = (value: string): value is KanbanFilterKey => KANBAN_FILTERS.some((f) => f === value);

const filterLabel = (filter: KanbanFilterKey, sprintCode: string | null): string =>
  filter === "sprint" ? fr.mode.sprint(sprintCode) : fr.mode[filter];

const shownLabel = (filters: readonly KanbanFilterKey[], sprintCode: string | null): string =>
  filters.length === 0 ? fr.mode.all : filters.map((f) => filterLabel(f, sprintCode)).join(" + ");

const SEGMENT =
  "h-[23px] gap-1.5 rounded-[5px] border border-transparent px-2.5 text-[12.5px] font-medium text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=on]:border-border data-[state=on]:bg-background data-[state=on]:text-foreground";

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
          className="h-[25px] shrink-0 gap-1.5 px-2.5 text-xs font-medium"
        >
          <Tag absoluteStrokeWidth size={13} aria-hidden className="size-[13px]" />
          <span className="@max-[48rem]/toolbar:sr-only">
            {label === null ? fr.labelFilter.all : fr.labelFilter.one(label)}
          </span>
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

type FiltersProps = Pick<Props, "filters" | "onFilters" | "onClear" | "total" | "counts" | "sprintCode">;

function BoardFilters({ filters, onFilters, onClear, total, counts, sprintCode }: FiltersProps) {
  const value = filters.length === 0 ? [ALL] : [...filters];
  const change = (next: string[]) => {
    if (next.includes(ALL) && !value.includes(ALL)) onClear();
    else onFilters(next.filter(isFilter));
  };
  return (
    <ToggleGroup
      type="multiple"
      role="group"
      size="sm"
      spacing={0.5}
      aria-label={fr.filter.label}
      value={value}
      onValueChange={change}
      className="shrink-0 rounded-[7px] bg-muted p-0.5"
    >
      <ToggleGroupItem value={ALL} aria-label={fr.mode.all} className={SEGMENT}>
        {fr.mode.all}
        <span className={COUNT}>{total}</span>
      </ToggleGroupItem>
      {KANBAN_FILTERS.map((f) => (
        <ToggleGroupItem
          key={f}
          value={f}
          aria-label={filterLabel(f, sprintCode)}
          disabled={f === "sprint" && sprintCode === null}
          className={SEGMENT}
        >
          {f === "toFix" && <RotateCcw absoluteStrokeWidth size={12} aria-hidden className="size-3" />}
          {filterLabel(f, sprintCode)}
          <span className={COUNT}>{counts[f]}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function KanbanToolbar(props: Props) {
  const { filters, sprintCode, label, onShowAll, shown, hidden, children } = props;
  const counter = fr.counter(shown, shownLabel(filters, sprintCode), props.mine);
  return (
    <header className="@container/toolbar flex h-12 items-center gap-2 border-b px-4 text-sm">
      <BoardFilters {...props} />
      <LabelMenu label={label} labels={props.labels} onLabel={props.onLabel} />
      {children}
      <span title={counter} className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
        {counter}
      </span>
      {(filters.length > 0 || label !== null) && hidden > 0 && (
        <Button size="sm" variant="link" className="h-auto shrink-0 px-0 text-xs" onClick={onShowAll}>
          {fr.hidden(hidden)}
        </Button>
      )}
    </header>
  );
}
