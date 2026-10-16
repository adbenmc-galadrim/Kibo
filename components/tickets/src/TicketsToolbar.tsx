import type { SprintView } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { Toggle } from "@kibo/sdk/ui/toggle";
import { ArrowUpDown, CircleCheck, Package } from "lucide-react";
import { type FeatureRef, featureName } from "./FeatureChip";
import type { TicketsQuery, TicketsSort } from "./filter-tickets";
import { fr } from "./fr";
import { SprintTabs } from "./SprintTabs";

type Props = {
  sprints: readonly SprintView[];
  sprint: string;
  onSprint(value: string): void;
  query: TicketsQuery;
  features: readonly FeatureRef[];
  onChange(query: TicketsQuery): void;
};

const OUTLINE = cn(
  "h-[25px] gap-[6px] rounded-[6px] border border-(--tracking-border) bg-transparent px-[9px] text-[12px] leading-[1.2] font-medium text-(--tracking-fg) shadow-none has-[>svg]:px-[9px]",
  "hover:bg-(--tracking-hover) hover:text-(--tracking-fg) dark:border-(--tracking-border) dark:bg-transparent dark:hover:bg-(--tracking-hover)",
  "data-[state=on]:bg-(--tracking-muted) data-[state=on]:text-(--tracking-fg)",
);

const ANY_FEATURE = "";
const SORTS: readonly TicketsSort[] = ["recent", "key"];

export function TicketsToolbar({ sprints, sprint, onSprint, query, features, onChange }: Props) {
  const chosen = features.find((f) => f.id === query.featureId) ?? null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SprintTabs sprints={sprints} value={sprint} onChange={onSprint} />
      <span className="flex-1" />
      <Toggle
        pressed={query.openOnly}
        onPressedChange={(openOnly) => onChange({ ...query, openOnly })}
        className={OUTLINE}
      >
        <CircleCheck aria-hidden className="size-[13px]" />
        {fr.filters.open}
      </Toggle>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={OUTLINE} aria-pressed={chosen !== null}>
            <Package aria-hidden className="size-[13px]" />
            {chosen ? (chosen.shortKey ?? chosen.keyLabel) : fr.filters.feature}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={OUTLINE}>
            <ArrowUpDown aria-hidden className="size-[13px]" />
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
