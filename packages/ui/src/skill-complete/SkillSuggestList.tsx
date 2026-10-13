import type { SkillSuggestion } from "@kibo/schema";
import { cn } from "@kibo/sdk/lib/utils";
import { frSkillComplete as t } from "../i18n/fr-skill-complete";

type Props = {
  id: string;
  items: readonly SkillSuggestion[];
  active: number;
  empty: string;
  placement: "above" | "below";
  onHover(index: number): void;
  onPick(skill: SkillSuggestion): void;
};

export const optionId = (listId: string, index: number) => `${listId}-option-${index}`;

const originOf = (s: SkillSuggestion): string =>
  s.source === "plugin" ? t.plugin(s.plugin ?? "") : s.source === "project" ? t.project : t.user;

export function SkillSuggestList({ id, items, active, empty, placement, onHover, onPick }: Props) {
  return (
    <div
      className={cn(
        "absolute inset-x-0 z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        placement === "above" ? "bottom-full mb-1" : "top-full mt-1",
      )}
    >
      <div id={id} role="listbox" aria-label={t.list} className="grid max-h-80 overflow-y-auto p-1">
        {items.map((skill, index) => (
          <button
            type="button"
            tabIndex={-1}
            key={skill.id}
            id={optionId(id, index)}
            role="option"
            aria-selected={index === active}
            className={cn(
              "grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded-sm px-2 py-1.5 text-left",
              index === active && "bg-accent text-accent-foreground",
            )}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(skill)}
          >
            <span className="truncate font-mono text-xs">/{skill.id}</span>
            <span className="text-2xs text-muted-foreground">{originOf(skill)}</span>
            <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
            <span className="text-right text-2xs tabular-nums text-muted-foreground">
              {t.usage(skill.runs30d)}
            </span>
          </button>
        ))}
      </div>
      {items.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{empty}</p>}
    </div>
  );
}
