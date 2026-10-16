import type { Ticket } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Package } from "lucide-react";
import { type FeatureRef, featureName } from "./FeatureChip";
import type { TicketsQuery } from "./filter-tickets";
import { fr } from "./fr";
import { LabelsMenuItems } from "./LabelsMenu";
import { OUTLINE } from "./toolbar-styles";

type Props = {
  query: TicketsQuery;
  features: readonly FeatureRef[];
  tickets: readonly Ticket[];
  onChange(query: TicketsQuery): void;
};

const ANY_FEATURE = "";

export function FeatureMenu({ query, features, tickets, onChange }: Props) {
  const chosen = features.find((f) => f.id === query.featureId) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={OUTLINE}
          aria-pressed={chosen !== null || query.labels.size > 0}
        >
          <Package aria-hidden className="size-[13px]" />
          {chosen ? (chosen.shortKey ?? chosen.keyLabel) : fr.filters.feature}
          {query.labels.size > 0 && (
            <span className="font-mono text-[11px] text-(--tracking-dim)">{query.labels.size}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={query.featureId ?? ANY_FEATURE}
          onValueChange={(v) => onChange({ ...query, featureId: v === ANY_FEATURE ? null : v })}
        >
          <DropdownMenuRadioItem value={ANY_FEATURE}>{fr.filters.allFeatures}</DropdownMenuRadioItem>
          {features.map((f) => (
            <DropdownMenuRadioItem key={f.id} value={f.id}>
              {featureName(f)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <LabelsMenuItems tickets={tickets} query={query} onChange={onChange} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
