import type { Status, StatusId } from "@kibo/schema";
import { agentTracesShown, StatusDot } from "@kibo/sdk";
import { useComponentSettings } from "@kibo/sdk/hooks/use-component-settings";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { CircleCheck } from "lucide-react";
import { type AssigneeFilter, cleared, isActive, narrowsOpen, type TicketsQuery } from "./filter-tickets";
import { fr } from "./fr";
import { OUTLINE } from "./toolbar-styles";

type Props = { query: TicketsQuery; statuses: readonly Status[]; onChange(query: TicketsQuery): void };

const ASSIGNEES: readonly AssigneeFilter[] = ["all", "me", "agents", "nobody"];

const toggled = (set: ReadonlySet<StatusId>, id: StatusId): Set<StatusId> => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

export function OpenMenu({ query, statuses, onChange }: Props) {
  const traces = agentTracesShown(useComponentSettings().agentExecution);
  const assignees = traces ? ASSIGNEES : ASSIGNEES.filter((a) => a !== "agents");
  const keep = (e: Event) => e.preventDefault();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={OUTLINE} aria-pressed={narrowsOpen(query)}>
          <CircleCheck absoluteStrokeWidth size={13} aria-hidden className="size-[13px]" />
          {fr.filters.open}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
        <DropdownMenuCheckboxItem
          checked={query.openOnly}
          onSelect={keep}
          onCheckedChange={(openOnly) => onChange({ ...query, openOnly })}
        >
          {fr.filters.openOnly}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={query.startable}
          onSelect={keep}
          onCheckedChange={(startable) => onChange({ ...query, startable })}
        >
          {fr.filters.startable}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-2xs font-medium">{fr.filters.status}</DropdownMenuLabel>
        {[...statuses]
          .sort((a, b) => a.order - b.order)
          .map((s) => (
            <DropdownMenuCheckboxItem
              key={s.id}
              checked={query.statuses.has(s.id)}
              onSelect={keep}
              onCheckedChange={() => onChange({ ...query, statuses: toggled(query.statuses, s.id) })}
            >
              <StatusDot statusId={s.id} />
              {s.label}
            </DropdownMenuCheckboxItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-2xs font-medium">{fr.filters.assignee}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={query.assignee}
          onValueChange={(v) => {
            const assignee = assignees.find((a) => a === v);
            if (assignee) onChange({ ...query, assignee });
          }}
        >
          {assignees.map((a) => (
            <DropdownMenuRadioItem key={a} value={a} onSelect={keep}>
              {fr.filters.assignees[a]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {isActive(query) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange(cleared(query))}>{fr.filters.clear}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
