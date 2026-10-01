import type { Theme } from "@kibo/schema";
import { useSyncExternalStore } from "react";
import { readPref, subscribePref, writePref } from "./lib/local-pref";

export type ThemePreference = "system" | "light" | "dark";

const KEY = "kibo.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export const nextTheme = (p: ThemePreference): ThemePreference =>
  p === "system" ? "light" : p === "light" ? "dark" : "system";

export function readThemePreference(): ThemePreference {
  const value = readPref(KEY, "system");
  return value === "light" || value === "dark" ? value : "system";
}

function apply(preference: ThemePreference): void {
  const dark = preference === "dark" || (preference === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];
export function setThemePreference(preference: ThemePreference): void {
  apply(preference);
  writePref(KEY, preference === "system" ? null : preference);
}

export function cycleTheme(): ThemePreference {
  const next = nextTheme(readThemePreference());
  setThemePreference(next);
  return next;
}

const subscribePreference = (onChange: () => void): (() => void) =>
  subscribePref(KEY, (external) => {
    if (external) apply(readThemePreference());
    onChange();
  });

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
