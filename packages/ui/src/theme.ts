import type { Theme } from "@kibo/schema";
import { useSyncExternalStore } from "react";

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

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

export function setThemePreference(preference: ThemePreference): void {
  withStorage((s) => (preference === "system" ? s.removeItem(KEY) : s.setItem(KEY, preference)), undefined);
  apply(preference);
  notify();
}

export function cycleTheme(): ThemePreference {
  const next = nextTheme(readThemePreference());
  setThemePreference(next);
  return next;
}

function subscribePreference(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) {
      apply(readThemePreference());
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export const useThemePreference = (): ThemePreference =>
  useSyncExternalStore(subscribePreference, readThemePreference);

export function followSystemTheme(): void {
  apply(readThemePreference());
  media().addEventListener("change", () => apply(readThemePreference()));
}

export const currentTheme = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export const useTheme = (): Theme => useSyncExternalStore(subscribeTheme, currentTheme);
