import type { Skill } from "@kibo/schema";

export const SKILL_FILTERS = ["all", "used", "notes"] as const;

export type SkillFilter = (typeof SKILL_FILTERS)[number];

export const isUsed = (skill: Skill): boolean => skill.usage.last !== null || skill.usage.runs30d > 0;

export function passesFilter(skill: Skill, filter: SkillFilter): boolean {
  if (filter === "used") return isUsed(skill);
  if (filter === "notes") return skill.reviews.open > 0;
  return true;
}

export const parseFilter = (raw: string): SkillFilter => SKILL_FILTERS.find((f) => f === raw) ?? "all";
