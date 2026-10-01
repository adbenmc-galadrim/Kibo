import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { Search } from "lucide-react";
import { frComponentsList as t } from "../i18n/fr-components-list";
import {
  type ComponentsQuery,
  DEFAULT_QUERY,
  type OriginFilter,
  type TrustFilter,
} from "./filter-components";

const TRUSTS: readonly TrustFilter[] = ["all", "trusted", "sandboxed", "pending"];
const ORIGINS: readonly OriginFilter[] = ["all", "kibo", "user", "ai", "marketplace"];

export const isFiltered = (q: ComponentsQuery): boolean =>
  q.text.trim() !== "" || q.trust !== DEFAULT_QUERY.trust || q.origin !== DEFAULT_QUERY.origin;

type ChoiceProps<T extends string> = {
  label: string;
  value: T;
  values: readonly T[];
  text: Record<T, string>;
  onChange(value: T): void;
};

function Choice<T extends string>({ label, value, values, text, onChange }: ChoiceProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label={label}
        value={value}
        onValueChange={(v) => {
          const next = values.find((x) => x === v);
          if (next) onChange(next);
        }}
      >
        {values.map((v) => (
          <ToggleGroupItem key={v} value={v} className="h-7 px-2.5 text-xs font-normal">
            {text[v]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

type Props = { query: ComponentsQuery; onChange(query: ComponentsQuery): void };

export function ComponentsFilters({ query, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="relative w-full sm:w-64">
        <Search
          aria-hidden
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={t.search}
          placeholder={t.search}
          className="h-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
          value={query.text}
          onChange={(e) => onChange({ ...query, text: e.target.value })}
        />
      </div>
      <Choice
        label={t.trustLabel}
        value={query.trust}
        values={TRUSTS}
        text={t.trust}
        onChange={(trust) => onChange({ ...query, trust })}
      />
      <Choice
        label={t.originLabel}
        value={query.origin}
        values={ORIGINS}
        text={t.origin}
        onChange={(origin) => onChange({ ...query, origin })}
      />
      {isFiltered(query) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => onChange({ ...DEFAULT_QUERY, sort: query.sort, descending: query.descending })}
        >
          {t.clear}
        </Button>
      )}
    </div>
  );
}
