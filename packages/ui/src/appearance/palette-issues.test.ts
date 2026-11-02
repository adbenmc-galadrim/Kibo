import { expect, test } from "bun:test";
import { fixIssues, paletteIssues } from "./palette-issues";
import { BUILT_IN_THEMES, themeById } from "./palette-presets";

test("every built-in theme is readable, except the historical light one", () => {
  for (const theme of BUILT_IN_THEMES) {
    if (theme.id === "clair") continue;
    expect({ id: theme.id, issues: paletteIssues(theme.roles) }).toEqual({ id: theme.id, issues: [] });
  }
});

test("a dark text on a dark surface is reported with its worst surface", () => {
  const roles = { ...themeById("graphite").roles, dim: "#52525B" };
  const issue = paletteIssues(roles).find((i) => i.role === "dim");
  expect(issue?.on).toBe("hover");
  expect(issue?.ratio).toBeLessThan(4.5);
});

test("an accent lost on its background is reported at 3:1", () => {
  const roles = { ...themeById("graphite").roles, accent: "#2A2A2E" };
  expect(paletteIssues(roles).find((i) => i.role === "accent")?.min).toBe(3);
});

test("fixing leaves no issue, whichever the theme", () => {
  for (const theme of BUILT_IN_THEMES) {
    const broken = { ...theme.roles, dim: theme.roles.hover, red: theme.roles.card };
    expect(paletteIssues(fixIssues(broken))).toEqual([]);
  }
});
