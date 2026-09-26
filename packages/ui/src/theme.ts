export type ThemePreference = "system" | "light" | "dark";

const KEY = "kibo.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export const nextTheme = (p: ThemePreference): ThemePreference =>
  p === "system" ? "light" : p === "light" ? "dark" : "system";

export function readThemePreference(): ThemePreference {
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "dark" ? value : "system";
}

function apply(preference: ThemePreference): void {
  const dark = preference === "dark" || (preference === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function cycleTheme(): ThemePreference {
  const next = nextTheme(readThemePreference());
  if (next === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, next);
  apply(next);
  return next;
}

export function followSystemTheme(): void {
  apply(readThemePreference());
  media().addEventListener("change", () => apply(readThemePreference()));
}
