import { afterEach, beforeEach, expect, test } from "bun:test";
import { cycleTheme, nextTheme, readThemePreference } from "./theme";

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
