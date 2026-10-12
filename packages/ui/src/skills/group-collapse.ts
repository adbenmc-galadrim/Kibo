import type { SkillGroupView } from "./skill-sections";

export type Collapsed = Record<string, boolean>;

export type CollapseState = { collapsed: Collapsed; overrides: Collapsed; searching: boolean };

export function parseCollapsed(raw: string): Collapsed {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"),
  );
}

function isOpen(group: SkillGroupView, { collapsed, overrides, searching }: CollapseState): boolean {
  const override = overrides[group.key];
  if (override !== undefined) return override;
  if (searching) return group.skills.length > 0;
  const stored = collapsed[group.key];
  return stored === undefined ? !group.readOnly : !stored;
}

export const openGroupKeys = (groups: readonly SkillGroupView[], state: CollapseState): Set<string> =>
  new Set(groups.filter((g) => isOpen(g, state)).map((g) => g.key));
