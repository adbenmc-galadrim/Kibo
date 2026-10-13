import type { ProjectSummary, Skill } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Input } from "@kibo/sdk/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@kibo/sdk/ui/toggle-group";
import { ChevronsDownUp, ChevronsUpDown, Package, Search } from "lucide-react";
import { useState } from "react";
import { frSkills } from "../i18n/fr-skills";
import { usePref } from "../lib/local-pref";
import { type Collapsed, openGroupKeys, parseCollapsed } from "./group-collapse";
import { SkillGroup } from "./SkillGroup";
import { parseFilter, SKILL_FILTERS, type SkillFilter } from "./skill-filters";
import { filterCounts, groupSkills, type SkillGroupView } from "./skill-sections";

export const SKILLS_FILTER_KEY = "kibo.skills.filter";
export const SKILLS_COLLAPSED_KEY = "kibo.skills.collapsed";

type Props = {
  skills: Skill[];
  projects: ProjectSummary[];
  partialWatch: boolean;
  reveal: string | null;
  onOpen(skill: Skill): void;
};
type Overrides = { scope: string; open: Collapsed };

const t = frSkills.page;
const SEGMENT =
  "h-7 rounded-md px-3 text-xs text-muted-foreground hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm";

function FilterSegment({
  value,
  counts,
  onChange,
}: {
  value: SkillFilter;
  counts: Record<SkillFilter, number>;
  onChange(filter: SkillFilter): void;
}) {
  return (
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label={t.filters}
      className="rounded-lg bg-muted p-[3px]"
      value={value}
      onValueChange={(v) => {
        if (v !== "") onChange(parseFilter(v));
      }}
    >
      {SKILL_FILTERS.map((f) => (
        <ToggleGroupItem key={f} value={f} className={SEGMENT}>
          {t.filterCount(t.filter[f], counts[f])}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function PluginsHeading() {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold">
      <Package aria-hidden className="size-4 text-muted-foreground" />
      {frSkills.groups.plugins}
      <span className="font-mono text-xs font-normal text-muted-foreground">
        {frSkills.groups.pluginsHint}
      </span>
    </h2>
  );
}

function useFolding(
  groups: readonly SkillGroupView[],
  scope: string,
  searching: boolean,
  reveal: string | null,
) {
  const [rawCollapsed, setRawCollapsed] = usePref(SKILLS_COLLAPSED_KEY, "{}");
  const [overrides, setOverrides] = useState<Overrides>({
    scope,
    open: reveal ? { [reveal]: true } : {},
  });
  const collapsed = parseCollapsed(rawCollapsed);
  const current = overrides.scope === scope ? overrides.open : {};
  const open = openGroupKeys(groups, { collapsed, overrides: current, searching });
  const setOpen = (keys: readonly string[], next: boolean) => {
    const changes = Object.fromEntries(keys.map((key) => [key, next]));
    const folded = Object.fromEntries(keys.map((key) => [key, !next]));
    setRawCollapsed(JSON.stringify({ ...collapsed, ...folded }));
    setOverrides({ scope, open: { ...current, ...changes } });
  };
  return { open, setOpen };
}

export function SkillList({ skills, projects, partialWatch, reveal, onOpen }: Props) {
  const now = Date.now();
  const [query, setQuery] = useState("");
  const [rawFilter, setRawFilter] = usePref(SKILLS_FILTER_KEY, "all");
  const filter = parseFilter(rawFilter);
  const groups = groupSkills(skills, projects, query, filter);
  const searching = query.trim() !== "" || filter !== "all";
  const { open, setOpen } = useFolding(groups, `${filter}:${query.trim()}`, searching, reveal);
  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.key));
  const firstPlugin = groups.find((g) => g.readOnly)?.key;
  const notes = skills.reduce((n, s) => n + s.reviews.open, 0);
  const FoldIcon = allOpen ? ChevronsDownUp : ChevronsUpDown;
  return (
    <div className="grid content-start gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search aria-hidden className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            type="search"
            aria-label={t.search}
            placeholder={t.search}
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <FilterSegment
          value={filter}
          counts={filterCounts(skills, projects, query)}
          onChange={setRawFilter}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={groups.length === 0}
          onClick={() =>
            setOpen(
              groups.map((g) => g.key),
              !allOpen,
            )
          }
        >
          <FoldIcon aria-hidden />
          {allOpen ? t.collapseAll : t.expandAll}
        </Button>
        <span className="flex-1" />
        {notes > 0 && <span className="text-sm font-medium text-brand-strong">{t.openNotes(notes)}</span>}
      </div>
      {partialWatch && <p className="text-xs text-muted-foreground">{t.partialWatch}</p>}
      {groups.length === 0 && <p className="text-sm text-muted-foreground">{t.empty}</p>}
      {groups.map((group) => (
        <div key={group.key} className="grid gap-2">
          {group.key === firstPlugin && <PluginsHeading />}
          <SkillGroup
            group={group}
            now={now}
            open={open.has(group.key)}
            onOpenChange={(next) => setOpen([group.key], next)}
            onOpen={onOpen}
          />
        </div>
      ))}
    </div>
  );
}
