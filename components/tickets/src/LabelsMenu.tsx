import { groupLabels, type Ticket } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { projectLabels, type TicketsQuery } from "./filter-tickets";
import { fr } from "./fr";

type Props = { tickets: readonly Ticket[]; query: TicketsQuery; onChange(query: TicketsQuery): void };

const toggled = (set: ReadonlySet<string>, label: string): Set<string> => {
  const next = new Set(set);
  if (next.has(label)) next.delete(label);
  else next.add(label);
  return next;
};

export function LabelsMenu({ tickets, query, onChange }: Props) {
  const groups = groupLabels(projectLabels(tickets));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={groups.length === 0}
          title={groups.length === 0 ? fr.labels.none : undefined}
          className="h-7 gap-1 px-2.5 text-xs font-normal"
        >
          {fr.labels.button}
          {query.labels.size > 0 && (
            <span className="rounded bg-muted px-1 font-mono text-3xs">{query.labels.size}</span>
          )}
          <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {groups.map((group, i) => (
          <Fragment key={group.prefix ?? ""}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-2xs font-normal text-muted-foreground">
                {group.prefix ?? fr.labels.free}
              </DropdownMenuLabel>
              {group.labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label}
                  checked={query.labels.has(label)}
                  className="font-mono text-xs"
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => onChange({ ...query, labels: toggled(query.labels, label) })}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
