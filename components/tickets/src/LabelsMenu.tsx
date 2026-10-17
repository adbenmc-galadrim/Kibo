import { groupLabels, type Ticket } from "@kibo/schema";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@kibo/sdk/ui/dropdown-menu";
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

export function LabelsMenuItems({ tickets, query, onChange }: Props) {
  const groups = groupLabels(projectLabels(tickets));
  return (
    <DropdownMenuGroup aria-label={fr.labels.title}>
      <DropdownMenuLabel className="text-2xs font-medium">{fr.labels.title}</DropdownMenuLabel>
      {groups.length === 0 && <DropdownMenuItem disabled>{fr.labels.none}</DropdownMenuItem>}
      {groups.map((group, i) => (
        <Fragment key={group.prefix ?? ""}>
          {i > 0 && <DropdownMenuSeparator />}
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
        </Fragment>
      ))}
    </DropdownMenuGroup>
  );
}
