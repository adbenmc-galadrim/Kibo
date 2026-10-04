import type { TicketView } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@kibo/sdk/ui/tooltip";
import { Filter, Network, Sparkle } from "lucide-react";
import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import { domainsOf, type GraphFilter } from "./filter";
import { fr } from "./fr";
import { GraphCanvas } from "./GraphCanvas";
import { initialFilter, useGraphData } from "./use-graph-data";

const TOGGLE = "h-7 text-xs aria-pressed:bg-accent dark:aria-pressed:bg-accent";

type ToolbarProps = {
  tickets: TicketView[];
  filter: GraphFilter;
  setFilter: Dispatch<SetStateAction<GraphFilter>>;
  showCritical: boolean;
  onToggleCritical(): void;
};

function FilterMenu({ tickets, filter, setFilter }: Omit<ToolbarProps, "showCritical" | "onToggleCritical">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Filter aria-hidden="true" />
          {fr.filter}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{fr.assignee}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={filter.assignee}
          onValueChange={(v) =>
            setFilter((f) => ({ ...f, assignee: v === "all" ? "all" : "mine-and-agents" }))
          }
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Toolbar(props: ToolbarProps) {
  const { filter, setFilter, showCritical, onToggleCritical } = props;
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              size="sm"
              variant="outline"
              className={`${TOGGLE} disabled:opacity-100`}
              aria-pressed
              disabled
            >
              <Network aria-hidden="true" />
              {fr.hierarchical}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{fr.hierarchicalHelp}</TooltipContent>
      </Tooltip>
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
        aria-pressed={filter.hideDone}
        onClick={() => setFilter((f) => ({ ...f, hideDone: !f.hideDone }))}
      >
        {fr.hideDone}
      </Button>
      <FilterMenu tickets={props.tickets} filter={filter} setFilter={setFilter} />
    </>
  );
}

export function GraphView() {
  const sdk = useSdk();
  const [showCritical, setShowCritical] = useState(true);
  const [filter, setFilter] = useState<GraphFilter>(() => initialFilter(sdk.config));
  const { allTickets, input, layout, path, runs, loading, failed, hasBlocks } = useGraphData(filter);
  const critical = useMemo(() => new Set(showCritical ? path : []), [path, showCritical]);
  const blocked = input.tickets.filter((t) => path.includes(t.id) && t.statusId === "blocked").length;

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Toolbar
            tickets={allTickets}
            filter={filter}
            setFilter={setFilter}
            showCritical={showCritical}
            onToggleCritical={() => setShowCritical((v) => !v)}
          />
          <span className="flex-1" />
          {path.length > 0 && (
            <span className="text-xs text-muted-foreground">{fr.summary(path.length, blocked)}</span>
          )}
        </div>
        {failed && (
          <p role="alert" className="p-4 text-sm text-destructive">
            {fr.loadFailed}
          </p>
        )}
        {!loading && !failed && !hasBlocks ? (
          <p className="grid flex-1 place-items-center p-6 text-sm text-muted-foreground">{fr.emptyView}</p>
        ) : (
          <div className="min-h-0 flex-1">
            <GraphCanvas
              tickets={input.tickets}
              edges={input.edges}
              layout={layout}
              critical={critical}
              runs={runs}
              onOpen={(id) => sdk.openTicket(id)}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
