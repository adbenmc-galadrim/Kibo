import type { TicketView } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Toggle } from "@kibo/sdk/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { CalendarRange, Filter, ListFilter, Sparkle } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { domainsOf, type GraphFilter } from "./filter";
import { fr } from "./fr";
import type { GraphColumns, GraphMode } from "./graph-model";

const TOGGLE = "h-7 text-xs aria-pressed:bg-accent dark:aria-pressed:bg-accent";

export type FilterProps = {
  tickets: TicketView[];
  filter: GraphFilter;
  setFilter: Dispatch<SetStateAction<GraphFilter>>;
};

export function FilterItems({ tickets, filter, setFilter }: FilterProps) {
  return (
    <>
      <DropdownMenuLabel>{fr.assignee}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={filter.assignee}
        onValueChange={(v) => setFilter((f) => ({ ...f, assignee: v === "all" ? "all" : "mine-and-agents" }))}
      >
        <DropdownMenuRadioItem value="mine-and-agents">{fr.mineAndAgents}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="all">{fr.all}</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>{fr.domain}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={filter.domain ?? ""}
        onValueChange={(v) => setFilter((f) => ({ ...f, domain: v === "" ? null : v }))}
      >
        <DropdownMenuRadioItem value="">{fr.allDomains}</DropdownMenuRadioItem>
        {domainsOf(tickets).map((d) => (
          <DropdownMenuRadioItem key={d} value={d}>
            {d}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

function FilterMenu(props: FilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Filter aria-hidden="true" />
          {fr.filter}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <FilterItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const isColumns = (v: string): v is GraphColumns => v === "sprints" || v === "waves";

type ColumnsProps = {
  value: GraphColumns;
  disabled: boolean;
  className: string;
  onChange(value: GraphColumns): void;
};

export function ColumnsMenu({ value, disabled, className, onChange }: ColumnsProps) {
  const label = fr.sprints.columns(value === "sprints" ? fr.sprints.columnSprints : fr.sprints.columnWaves);
  const trigger = (
    <Button size="sm" variant="outline" className={className} disabled={disabled}>
      <CalendarRange aria-hidden="true" />
      {label}
    </Button>
  );
  if (disabled) return <span title={fr.sprints.noSprint}>{trigger}</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => isColumns(v) && onChange(v)}>
          <DropdownMenuRadioItem value="sprints">{fr.sprints.columnSprints}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="waves">{fr.sprints.columnWaves}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const isMode = (v: string): v is GraphMode => v === "waves" || v === "hierarchical";

type ToolbarProps = FilterProps & {
  mode: GraphMode;
  onMode(mode: GraphMode): void;
  showCritical: boolean;
  onToggleCritical(): void;
  doneCount: number;
  children: ReactNode;
};

export function GraphToolbar(props: ToolbarProps) {
  const { filter, setFilter, showCritical, onToggleCritical, mode, onMode } = props;
  return (
    <>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={fr.layout}
        value={mode}
        onValueChange={(v) => isMode(v) && onMode(v)}
      >
        <ToggleGroupItem value="waves" className="h-7 px-2.5 text-xs">
          {fr.waves}
        </ToggleGroupItem>
        <ToggleGroupItem value="hierarchical" className="h-7 px-2.5 text-xs">
          {fr.hierarchical}
        </ToggleGroupItem>
      </ToggleGroup>
      <Button
        size="sm"
        variant="outline"
        className={TOGGLE}
        aria-pressed={showCritical}
        onClick={onToggleCritical}
      >
        <Sparkle aria-hidden="true" />
        {fr.critical}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={TOGGLE}
        aria-pressed={filter.showDone}
        onClick={() => setFilter((f) => ({ ...f, showDone: !f.showDone }))}
      >
        {fr.showDone(props.doneCount)}
      </Button>
      <Toggle
        variant="outline"
        size="sm"
        pressed={filter.startable}
        onPressedChange={(startable) => setFilter((f) => ({ ...f, startable }))}
        className="h-7 shrink-0 gap-1 px-2.5 text-xs font-normal"
      >
        <ListFilter aria-hidden className="size-3.5" />
        {fr.startableFilter}
      </Toggle>
      <FilterMenu tickets={props.tickets} filter={filter} setFilter={setFilter} />
      {props.children}
    </>
  );
}
