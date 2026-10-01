import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { readPref, usePref, writePref } from "./local-pref";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("a preference reads its fallback, then what was written, and null clears it", () => {
  expect(readPref("k", "x")).toBe("x");
  writePref("k", "y");
  expect(readPref("k", "x")).toBe("y");
  expect(localStorage.getItem("k")).toBe("y");
  writePref("k", null);
  expect(localStorage.getItem("k")).toBeNull();
  expect(readPref("k", "x")).toBe("x");
});

test("an unavailable storage falls back silently and logs one line per access", () => {
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
    expect(readPref("k", "x")).toBe("x");
    expect(errors).toHaveLength(1);
    expect(() => writePref("k", "y")).not.toThrow();
    expect(errors).toHaveLength(2);
  } finally {
    console.error = log;
    if (storage) Object.defineProperty(window, "localStorage", storage);
  }
});

test("usePref follows writePref and the storage event of another window", () => {
  const { result } = renderHook(() => usePref("kibo.test", "on"));
  expect(result.current[0]).toBe("on");
  act(() => result.current[1]("off"));
  expect(result.current[0]).toBe("off");
  expect(localStorage.getItem("kibo.test")).toBe("off");
  act(() => writePref("kibo.test", "on"));
  expect(result.current[0]).toBe("on");
  act(() => {
    localStorage.setItem("kibo.test", "off");
    window.dispatchEvent(new StorageEvent("storage", { key: "kibo.test" }));
  });
  expect(result.current[0]).toBe("off");
});
