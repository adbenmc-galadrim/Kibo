export type ThemePreference = "system" | "light" | "dark";

const KEY = "kibo.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export const nextTheme = (p: ThemePreference): ThemePreference =>
  p === "system" ? "light" : p === "light" ? "dark" : "system";

function withStorage<T>(work: (storage: Storage) => T, fallback: T): T {
  try {
    return work(window.localStorage);
  } catch (e) {
    console.error("theme storage unavailable", e);
    return fallback;
  }
}

export function readThemePreference(): ThemePreference {
  const value = withStorage((s) => s.getItem(KEY), null);
  return value === "light" || value === "dark" ? value : "system";
}

function apply(preference: ThemePreference): void {
  const dark = preference === "dark" || (preference === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function cycleTheme(): ThemePreference {
  const next = nextTheme(readThemePreference());
  withStorage((s) => (next === "system" ? s.removeItem(KEY) : s.setItem(KEY, next)), undefined);
  apply(next);
  return next;
}

export function followSystemTheme(): void {
  apply(readThemePreference());
  media().addEventListener("change", () => apply(readThemePreference()));
}
