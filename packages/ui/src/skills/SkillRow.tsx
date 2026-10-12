import type { Skill } from "@kibo/schema";
import { Badge } from "@kibo/sdk/ui/badge";
import { ChevronRight, EyeOff, Lock, MessageSquareText } from "lucide-react";
import { frSkills } from "../i18n/fr-skills";
import { agoText } from "./skill-sections";

type Props = { skill: Skill; now: number; onOpen(skill: Skill): void };

const t = frSkills.row;

export function usageText(skill: Skill, now: number): string {
  const runs = skill.usage.runs30d;
  if (!skill.usage.last) return runs > 0 ? t.runs30d(runs) : t.never;
  return `${t.usedAgo(agoText(now - skill.usage.last.at))} · ${t.runs30d(runs)}`;
}

export function SkillRow({ skill, now, onOpen }: Props) {
  const shadowed = skill.shadowedBy !== null;
  return (
    <li>
      <button
        type="button"
        aria-label={t.open(skill.id)}
        onClick={() => onOpen(skill)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 px-4 py-2.5 text-left hover:bg-accent/60"
      >
        <span className="grid min-w-0 gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={
                shadowed ? "font-mono text-sm text-muted-foreground" : "font-mono text-sm font-medium"
              }
            >
              {skill.id}
            </span>
            {shadowed && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal" title={t.shadowedHelp}>
                <EyeOff aria-hidden className="size-3" />
                {t.shadowed}
              </Badge>
            )}
            {skill.readOnly && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                <Lock aria-hidden className="size-3" />
                {t.readOnly}
              </Badge>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {skill.problem ? t.unreadable(skill.problem) : shadowed ? t.shadowedHelp : skill.description}
          </span>
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-brand-strong">
          {skill.reviews.open > 0 && (
            <>
              <MessageSquareText aria-hidden className="size-3.5" />
              {t.notes(skill.reviews.open)}
            </>
          )}
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {usageText(skill, now)}
          <ChevronRight aria-hidden className="size-4" />
        </span>
      </button>
    </li>
  );
}
