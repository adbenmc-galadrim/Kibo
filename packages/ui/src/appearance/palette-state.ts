import type { StoredPalette } from "@kibo/schema";
import { BUILT_IN_THEMES, DEFAULT_THEME, type ThemeDef, themeById } from "./palette-presets";
import type { Role, Roles, Scheme } from "./palette-roles";

export const EMPTY_PALETTE: StoredPalette = { active: {}, drafts: {}, custom: [] };

export type ActiveTheme = {
  theme: ThemeDef;
  roles: Roles;
  modified: boolean;
  pristineDefault: boolean;
};

const ownThemes = (state: StoredPalette): ThemeDef[] => state.custom.map((t) => ({ ...t, custom: true }));

export const themesFor = (state: StoredPalette, scheme: Scheme): ThemeDef[] =>
  [...BUILT_IN_THEMES, ...ownThemes(state)].filter((t) => t.scheme === scheme);

export function activeTheme(state: StoredPalette, scheme: Scheme): ActiveTheme {
  const wanted = state.active[scheme];
  const theme = themesFor(state, scheme).find((t) => t.id === wanted) ?? themeById(DEFAULT_THEME[scheme]);
  const draft = state.drafts[theme.id] ?? {};
  const modified = Object.keys(draft).length > 0;
  return {
    theme,
    roles: { ...theme.roles, ...draft },
    modified,
    pristineDefault: theme.id === DEFAULT_THEME[scheme] && !modified,
  };
}

export const selectTheme = (state: StoredPalette, scheme: Scheme, id: string): StoredPalette => ({
  ...state,
  active: { ...state.active, [scheme]: id },
});

export function editRoles(state: StoredPalette, scheme: Scheme, changes: Partial<Roles>): StoredPalette {
  const { theme } = activeTheme(state, scheme);
  if (theme.custom)
    return {
      ...state,
      custom: state.custom.map((t) => (t.id === theme.id ? { ...t, roles: { ...t.roles, ...changes } } : t)),
    };
  return {
    ...state,
    drafts: { ...state.drafts, [theme.id]: { ...state.drafts[theme.id], ...changes } },
  };
}

export const editRole = (state: StoredPalette, scheme: Scheme, role: Role, value: string): StoredPalette =>
  editRoles(state, scheme, { [role]: value });

export function resetDraft(state: StoredPalette, scheme: Scheme): StoredPalette {
  const { theme } = activeTheme(state, scheme);
  const { [theme.id]: _removed, ...drafts } = state.drafts;
  return { ...state, drafts };
}

export function saveAsTheme(state: StoredPalette, scheme: Scheme, name: string, id: string): StoredPalette {
  const { roles } = activeTheme(state, scheme);
  const cleared = resetDraft(state, scheme);
  return selectTheme(
    { ...cleared, custom: [...cleared.custom, { id, name: name.trim(), scheme, roles }] },
    scheme,
    id,
  );
}

export const deleteTheme = (state: StoredPalette, id: string): StoredPalette => ({
  ...state,
  custom: state.custom.filter((t) => t.id !== id),
});
