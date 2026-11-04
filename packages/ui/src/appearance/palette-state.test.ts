import { expect, test } from "bun:test";
import {
  activeTheme,
  deleteTheme,
  EMPTY_PALETTE,
  editRole,
  resetDraft,
  saveAsTheme,
  selectTheme,
  themesFor,
} from "./palette-state";

const NEW_ID = "custom-1";

test("each scheme starts on its own default theme", () => {
  expect(activeTheme(EMPTY_PALETTE, "dark").theme.id).toBe("graphite");
  expect(activeTheme(EMPTY_PALETTE, "light").theme.id).toBe("clair");
  expect(activeTheme(EMPTY_PALETTE, "dark").pristineDefault).toBe(true);
});

test("a theme is chosen per scheme and only lists its scheme", () => {
  const state = selectTheme(EMPTY_PALETTE, "dark", "prune");
  expect(activeTheme(state, "dark").theme.id).toBe("prune");
  expect(activeTheme(state, "light").theme.id).toBe("clair");
  expect(themesFor(state, "light").map((t) => t.id)).not.toContain("prune");
});

test("editing a built-in theme keeps a draft that survives a theme switch and can be undone", () => {
  let state = editRole(EMPTY_PALETTE, "dark", "bg", "#123456");
  expect(activeTheme(state, "dark").roles.bg).toBe("#123456");
  expect(activeTheme(state, "dark").modified).toBe(true);
  state = selectTheme(selectTheme(state, "dark", "noir"), "dark", "graphite");
  expect(activeTheme(state, "dark").roles.bg).toBe("#123456");
  state = resetDraft(state, "dark");
  expect(activeTheme(state, "dark").modified).toBe(false);
  expect(activeTheme(state, "dark").pristineDefault).toBe(true);
});

test("saving creates an own theme from the current colors and leaves the built-in intact", () => {
  const edited = editRole(selectTheme(EMPTY_PALETTE, "dark", "noir"), "dark", "bg", "#123456");
  const state = saveAsTheme(edited, "dark", "  Mon thème ", NEW_ID);
  const { theme, roles, modified } = activeTheme(state, "dark");
  expect(theme.name).toBe("Mon thème");
  expect(theme.custom).toBe(true);
  expect(roles.bg).toBe("#123456");
  expect(modified).toBe(false);
  expect(activeTheme(selectTheme(state, "dark", "noir"), "dark").roles.bg).toBe("#09090B");
});

test("an own theme is edited directly and can be deleted, back to the default", () => {
  let state = saveAsTheme(EMPTY_PALETTE, "dark", "Mon thème", NEW_ID);
  state = editRole(state, "dark", "fg", "#EEEEEE");
  expect(state.custom[0]?.roles.fg).toBe("#EEEEEE");
  state = deleteTheme(state, NEW_ID);
  expect(state.custom).toEqual([]);
  expect(activeTheme(state, "dark").theme.id).toBe("graphite");
});

test("an unknown active theme falls back to the default", () => {
  const state = { ...EMPTY_PALETTE, active: { dark: "gone" } };
  expect(activeTheme(state, "dark").theme.id).toBe("graphite");
});
