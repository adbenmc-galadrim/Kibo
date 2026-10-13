import type { ProjectSummary, Skill, SkillId, SkillScope } from "@kibo/schema";
import { frSkills } from "../i18n/fr-skills";
import { passesFilter, type SkillFilter } from "./skill-filters";

export type SkillGroupView = {
  key: string;
  title: string;
  hint: string | null;
  color: string | null;
  readOnly: boolean;
  skills: Skill[];
};

export type SkillAddress = SkillScope & { id: SkillId };

const t = frSkills.groups;
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const byName = (a: Skill, b: Skill) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export const matchesSkill = (skill: Skill, query: string): boolean => {
  const q = plain(query.trim());
  return q === "" || plain(`${skill.id} ${skill.name} ${skill.description}`).includes(q);
};

export function groupSkills(
  skills: readonly Skill[],
  projects: readonly ProjectSummary[],
  query: string,
  filter: SkillFilter = "all",
): SkillGroupView[] {
  const shown = skills.filter((s) => matchesSkill(s, query) && passesFilter(s, filter)).sort(byName);
  const plugins = [...new Map(shown.flatMap((s) => (s.plugin ? [[s.plugin.name, s.plugin]] : []))).values()];
  const groups: SkillGroupView[] = [
    {
      key: "user",
      title: t.computer,
      hint: t.computerRoot,
      color: null,
      readOnly: false,
      skills: shown.filter((s) => s.source === "user"),
    },
    ...projects.flatMap((p) =>
      p.folder === null
        ? []
        : [
            {
              key: `project:${p.id}`,
              title: t.project(p.name),
              hint: `${p.folder}/.claude/skills`,
              color: p.color,
              readOnly: false,
              skills: shown.filter((s) => s.source === "project" && s.projectId === p.id),
            },
          ],
    ),
    ...plugins
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((plugin) => ({
        key: `plugin:${plugin.name}`,
        title: t.plugin(plugin.name, plugin.version),
        hint: null,
        color: null,
        readOnly: true,
        skills: shown.filter((s) => s.plugin?.name === plugin.name),
      })),
  ];
  return query.trim() === "" && filter === "all" ? groups : groups.filter((g) => g.skills.length > 0);
}

export function filterCounts(
  skills: readonly Skill[],
  projects: readonly ProjectSummary[],
  query: string,
): Record<SkillFilter, number> {
  const count = (filter: SkillFilter) =>
    groupSkills(skills, projects, query, filter).reduce((n, g) => n + g.skills.length, 0);
  return { all: count("all"), used: count("used"), notes: count("notes") };
}

export const groupNotes = (group: SkillGroupView): number =>
  group.skills.reduce((n, s) => n + s.reviews.open, 0);

export function groupKeyOf(skill: Pick<Skill, "source" | "projectId" | "plugin">): string {
  if (skill.source === "project") return `project:${skill.projectId ?? ""}`;
  if (skill.source === "plugin" && skill.plugin) return `plugin:${skill.plugin.name}`;
  return "user";
}

export function skillAddress(
  skill: Pick<Skill, "id" | "source" | "projectId"> & { plugin: { name: string } | null },
): SkillAddress {
  if (skill.source === "project" && skill.projectId)
    return { id: skill.id, scope: "project", projectId: skill.projectId };
  if (skill.source === "plugin" && skill.plugin)
    return { id: skill.id, scope: "plugin", plugin: skill.plugin.name };
  return { id: skill.id, scope: skill.source };
}

export function skillHistoryRef(skill: Pick<Skill, "id" | "source" | "projectId">): string {
  if (skill.source === "project") return `project:${skill.projectId ?? ""}:${skill.id}`;
  return `${skill.source}:${skill.id}`;
}

export function agoText(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return frSkills.ago.minutes(minutes);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return frSkills.ago.hours(hours);
  return frSkills.ago.days(Math.round(hours / 24));
}

export const sameSkill = (a: Skill, b: Pick<Skill, "id" | "source" | "projectId">): boolean =>
  a.id === b.id && a.source === b.source && a.projectId === b.projectId;
