import { rankSkillSuggestions, type Skill, type SkillSuggestion, type SkillsRule } from "@kibo/schema";

const allowed = (rule: SkillsRule, skill: Skill): boolean =>
  rule.mode === "all" || rule.ids.includes(skill.id);

const suggestionOf = (skill: Skill): SkillSuggestion => ({
  id: skill.id,
  name: skill.name,
  description: skill.description,
  source: skill.source,
  plugin: skill.plugin?.name ?? null,
  runs30d: skill.usage.runs30d,
  lastAt: skill.usage.last?.at ?? null,
});

export function suggestSkills(visible: readonly Skill[], rule: SkillsRule): SkillSuggestion[] {
  const loaded = visible.filter((s) => s.shadowedBy === null && allowed(rule, s));
  return rankSkillSuggestions(loaded.map(suggestionOf));
}
