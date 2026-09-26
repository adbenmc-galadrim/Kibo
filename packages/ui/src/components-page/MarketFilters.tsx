import type { ComponentKind, MarketSourceInfo } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@kibo/sdk/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { fr } from "../i18n/fr";

const ANY = "*";
const KINDS: ComponentKind[] = ["widget", "view", "both"];

type Option = { value: string; label: string };
type FilterProps = { label: string; value: string; options: Option[]; onChange(value: string): void };

function Filter({ label, value, options, onChange }: FilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 gap-1.5 px-3 text-xs font-normal text-muted-foreground">
          {label}
          <ChevronDown aria-hidden className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Props = {
  sources: MarketSourceInfo[];
  sourceId: string | null;
  kind: ComponentKind | null;
  onSource(id: string | null): void;
  onKind(kind: ComponentKind | null): void;
};

export function MarketFilters({ sources, sourceId, kind, onSource, onKind }: Props) {
  const t = fr.market;
  const sourceName = sources.find((s) => s.id === sourceId)?.name ?? null;
  return (
    <>
      <Filter
        label={t.sourceFilter(sourceName)}
        value={sourceId ?? ANY}
        options={[
          { value: ANY, label: t.anySource },
          ...sources.map((s) => ({ value: s.id, label: s.name })),
        ]}
        onChange={(v) => onSource(v === ANY ? null : v)}
      />
      <Filter
        label={t.kindFilter(kind ? t.kind[kind] : null)}
        value={kind ?? ANY}
        options={[{ value: ANY, label: t.anyKind }, ...KINDS.map((k) => ({ value: k, label: t.kind[k] }))]}
        onChange={(v) => onKind(KINDS.find((k) => k === v) ?? null)}
      />
    </>
  );
}
