import type { Status, StatusId } from "@kibo/schema";
import { StatusDot } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Input } from "@kibo/sdk/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { ChevronDown, Search } from "lucide-react";
import { type AssigneeFilter, EMPTY_QUERY, isActive, type TicketsQuery } from "./filter-tickets";
import { fr } from "./fr";

const ASSIGNEES: readonly AssigneeFilter[] = ["all", "me", "agents", "nobody"];

type Props = { query: TicketsQuery; statuses: Status[]; onChange(query: TicketsQuery): void };

const toggled = (set: ReadonlySet<StatusId>, id: StatusId): Set<StatusId> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

export function TicketsToolbar({ query, statuses, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
      <div className="relative w-full sm:w-56">
        <Search
          aria-hidden
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={fr.search}
          placeholder={fr.search}
          className="h-7 pl-8 text-xs [&::-webkit-search-cancel-button]:hidden"
          value={query.text}
          onChange={(e) => onChange({ ...query, text: e.target.value })}
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs font-normal">
            {fr.statusFilter}
            {query.statuses.size > 0 && (
              <span className="rounded bg-muted px-1 font-mono text-3xs">{query.statuses.size}</span>
            )}
            <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {statuses.map((s) => (
            <DropdownMenuCheckboxItem
              key={s.id}
              checked={query.statuses.has(s.id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => onChange({ ...query, statuses: toggled(query.statuses, s.id) })}
            >
              <StatusDot statusId={s.id} />
              {s.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{fr.assigneeFilter}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label={fr.assigneeFilter}
          value={query.assignee}
          onValueChange={(v) => {
            const next = ASSIGNEES.find((a) => a === v);
            if (next) onChange({ ...query, assignee: next });
          }}
        >
          {ASSIGNEES.map((a) => (
            <ToggleGroupItem key={a} value={a} className="h-7 px-2.5 text-xs font-normal">
              {fr.assignees[a]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {isActive(query) && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange(EMPTY_QUERY)}>
          {fr.clear}
        </Button>
      )}
    </div>
  );
}
