import type { SkillId, SkillSource } from "./skill";

export const SKILL_SUGGESTIONS_VISIBLE = 8;

export type SkillSuggestion = {
  id: SkillId;
  name: string;
  description: string;
  source: SkillSource;
  plugin: string | null;
  runs30d: number;
  lastAt: number | null;
};

const byUsage = (a: SkillSuggestion, b: SkillSuggestion): number =>
  b.runs30d - a.runs30d || (b.lastAt ?? -1) - (a.lastAt ?? -1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const rankSkillSuggestions = (list: readonly SkillSuggestion[]): SkillSuggestion[] =>
  [...list].sort(byUsage);

const startsWith = (id: string, query: string): boolean =>
  id.startsWith(query) || (id.split(":").at(-1) ?? id).startsWith(query);

export function filterSkillSuggestions(ranked: readonly SkillSuggestion[], query: string): SkillSuggestion[] {
  const q = query.toLowerCase();
  const prefix = ranked.filter((s) => startsWith(s.id, q));
  const inner = ranked.filter((s) => !startsWith(s.id, q) && s.id.includes(q));
  return [...prefix, ...inner].slice(0, SKILL_SUGGESTIONS_VISIBLE);
}
