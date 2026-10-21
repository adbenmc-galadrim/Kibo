import { beforeEach, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { PANEL_LIST_KEY, PANEL_WIDE_KEY, usePanelLayout } from "./use-panel-layout";

beforeEach(() => localStorage.clear());

test("the panel is narrow with its list shown by default", () => {
  const { result } = renderHook(() => usePanelLayout());
  expect(result.current.wide).toBe(false);
  expect(result.current.list).toBe(true);
});

test("the wide mode and the hidden list are remembered", () => {
  const first = renderHook(() => usePanelLayout());
  act(() => first.result.current.setWide(true));
  act(() => first.result.current.setList(false));
  expect(localStorage.getItem(PANEL_WIDE_KEY)).toBe("1");
  expect(localStorage.getItem(PANEL_LIST_KEY)).toBe("0");
  first.unmount();
  const again = renderHook(() => usePanelLayout());
  expect(again.result.current.wide).toBe(true);
  expect(again.result.current.list).toBe(false);
});

test("foreign values fall back to the defaults", () => {
  localStorage.setItem(PANEL_WIDE_KEY, "x");
  localStorage.setItem(PANEL_LIST_KEY, "x");
  const { result } = renderHook(() => usePanelLayout());
  expect(result.current.wide).toBe(false);
  expect(result.current.list).toBe(true);
});
