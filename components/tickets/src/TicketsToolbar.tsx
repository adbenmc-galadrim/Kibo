import type { SprintView, Status, Ticket } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ArrowUpDown } from "lucide-react";
import type { FeatureRef } from "./FeatureChip";
import { FeatureMenu } from "./FeatureMenu";
import type { TicketsQuery, TicketsSort } from "./filter-tickets";
import { fr } from "./fr";
import { OpenMenu } from "./OpenMenu";
import { SearchField } from "./SearchField";
import { SprintTabs } from "./SprintTabs";
import { OUTLINE } from "./toolbar-styles";

type Props = {
  sprints: readonly SprintView[];
  sprint: string;
  onSprint(value: string): void;
  query: TicketsQuery;
  features: readonly FeatureRef[];
  statuses: readonly Status[];
  tickets: readonly Ticket[];
  searching: boolean;
  onSearchClose(): void;
  onChange(query: TicketsQuery): void;
};

const SORTS: readonly TicketsSort[] = ["recent", "key"];

export function TicketsToolbar(props: Props) {
  const { query, onChange } = props;
  const sdk = useSdk();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.searching ? (
        <SearchField
          value={query.text}
          onChange={(text) => onChange({ ...query, text })}
          onClose={props.onSearchClose}
        />
      ) : (
        <SprintTabs
          sprints={props.sprints}
          value={props.sprint}
          onChange={props.onSprint}
          onOpenSprint={(id) => sdk.sprints.open(id)}
        />
      )}
      <span className="flex-1" />
      <OpenMenu query={query} statuses={props.statuses} onChange={onChange} />
      <FeatureMenu query={query} features={props.features} tickets={props.tickets} onChange={onChange} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={OUTLINE}>
            <ArrowUpDown absoluteStrokeWidth size={13} aria-hidden className="size-[13px]" />
            {fr.filters.sort[query.sort]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={query.sort}
            onValueChange={(v) => {
              const sort = SORTS.find((s) => s === v);
              if (sort) onChange({ ...query, sort });
            }}
          >
            {SORTS.map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {fr.filters.sort[s]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
