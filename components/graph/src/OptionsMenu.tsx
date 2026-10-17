import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { SlidersHorizontal } from "lucide-react";
import { fr } from "./fr";
import { FilterItems, type FilterProps } from "./GraphToolbar";

type Props = FilterProps & {
  showCritical: boolean;
  onToggleCritical(): void;
  doneCount: number;
  className: string;
};

export function OptionsMenu({
  tickets,
  filter,
  setFilter,
  showCritical,
  onToggleCritical,
  doneCount,
  className,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className={className}>
          <SlidersHorizontal aria-hidden="true" />
          {fr.sprints.options}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuCheckboxItem checked={showCritical} onCheckedChange={onToggleCritical}>
          {fr.critical}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filter.startable}
          onCheckedChange={(startable) => setFilter((f) => ({ ...f, startable }))}
        >
          {fr.startableFilter}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filter.showDone}
          onCheckedChange={(showDone) => setFilter((f) => ({ ...f, showDone }))}
        >
          {fr.showDone(doneCount)}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <FilterItems tickets={tickets} filter={filter} setFilter={setFilter} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
