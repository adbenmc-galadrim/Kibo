import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { DOCK_HEIGHT_KEY, DOCK_MIN, useDockHeight } from "./use-dock-height";

beforeEach(() => {
  window.sessionStorage.clear();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
});
afterEach(() => window.sessionStorage.clear());

test("the dock starts at 45 % of the window", () => {
  const { result } = renderHook(() => useDockHeight());
  expect(result.current.height).toBe(450);
});

test("the height is kept between 160 px and 80 % of the window, and stored for the window", () => {
  const { result } = renderHook(() => useDockHeight());
  act(() => result.current.set(20));
  expect(result.current.height).toBe(DOCK_MIN);
  act(() => result.current.set(5000));
  expect(result.current.height).toBe(800);
  act(() => result.current.set(612.4));
  expect(result.current.height).toBe(612);
  expect(window.sessionStorage.getItem(DOCK_HEIGHT_KEY)).toBe("612");
});

test("a stored height is read back, an unreadable one falls back to the default", () => {
  window.sessionStorage.setItem(DOCK_HEIGHT_KEY, "300");
  expect(renderHook(() => useDockHeight()).result.current.height).toBe(300);
  window.sessionStorage.setItem(DOCK_HEIGHT_KEY, "abc");
  expect(renderHook(() => useDockHeight()).result.current.height).toBe(450);
});

test("reset goes back to the default height", () => {
  window.sessionStorage.setItem(DOCK_HEIGHT_KEY, "300");
  const { result } = renderHook(() => useDockHeight());
  act(() => result.current.reset());
  expect(result.current.height).toBe(450);
  expect(window.sessionStorage.getItem(DOCK_HEIGHT_KEY)).toBeNull();
});
