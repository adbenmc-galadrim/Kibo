import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import {
  currentTheme,
  cycleTheme,
  nextTheme,
  readThemePreference,
  setThemePreference,
  THEME_PREFERENCES,
  useTheme,
  useThemePreference,
} from "./theme";

beforeEach(() => localStorage.clear());
afterEach(() => document.documentElement.classList.remove("dark"));

test("the theme cycles system → light → dark and is remembered", () => {
  expect(nextTheme("system")).toBe("light");
  expect(nextTheme("light")).toBe("dark");
  expect(nextTheme("dark")).toBe("system");
  expect(readThemePreference()).toBe("system");
  expect(cycleTheme()).toBe("light");
  expect(document.documentElement.classList.contains("dark")).toBe(false);
  expect(cycleTheme()).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(readThemePreference()).toBe("dark");
});

test("an unavailable storage falls back to the system theme and is reported", () => {
  const storage = Object.getOwnPropertyDescriptor(window, "localStorage");
  const errors: unknown[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("denied", "SecurityError");
    },
  });
  try {
    expect(readThemePreference()).toBe("system");
    expect(cycleTheme()).toBe("light");
    expect(errors.length).toBeGreaterThan(0);
  } finally {
    if (storage) Object.defineProperty(window, "localStorage", storage);
    console.error = log;
  }
});

test("the current theme follows the dark class of the document", async () => {
  expect(currentTheme()).toBe("light");
  const { result } = renderHook(() => useTheme());
  expect(result.current).toBe("light");
  await act(async () => {
    document.documentElement.classList.add("dark");
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(currentTheme()).toBe("dark");
  expect(result.current).toBe("dark");
});

test("the preference is set directly, applied, and observed by the hook", () => {
  expect(THEME_PREFERENCES).toEqual(["system", "light", "dark"]);
  const { result } = renderHook(() => useThemePreference());
  expect(result.current).toBe("system");
  act(() => setThemePreference("dark"));
  expect(result.current).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
  expect(localStorage.getItem("kibo.theme")).toBe("dark");
  act(() => setThemePreference("system"));
  expect(result.current).toBe("system");
  expect(localStorage.getItem("kibo.theme")).toBeNull();
  act(() => {
    localStorage.setItem("kibo.theme", "light");
    window.dispatchEvent(new StorageEvent("storage", { key: "kibo.theme", newValue: "light" }));
  });
  expect(result.current).toBe("light");
  act(() => {
    expect(cycleTheme()).toBe("dark");
  });
  expect(result.current).toBe("dark");
});
