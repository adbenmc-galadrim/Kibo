import { expect, mock, test } from "bun:test";
import { EMPTY_TABS, type TabTarget } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import type { TabsApi } from "./use-tabs";

const shown: (() => void)[] = [];
mock.module("./closed-toast", () => ({
  showClosedTabToast: async (onUndo: () => void) => {
    shown.push(onUndo);
  },
}));
const { useClosedTabToast } = await import("./use-closed-tab-toast");

const target: TabTarget = { kind: "screen", screen: "agents" };
const api = (closures: number, closed: TabTarget[], reopen = () => {}): TabsApi => ({
  state: EMPTY_TABS,
  error: null,
  dispatch: () => {},
  open: () => {},
  closed,
  closures,
  reopen,
});

test("each close shows the toast once, and its action reopens", () => {
  shown.length = 0;
  const reopen = mock(() => {});
  const { rerender } = renderHook((props: TabsApi) => useClosedTabToast(props), {
    initialProps: api(0, [], reopen),
  });
  expect(shown).toHaveLength(0);
  rerender(api(1, [target], reopen));
  expect(shown).toHaveLength(1);
  rerender(api(1, [target], reopen));
  expect(shown).toHaveLength(1);
  shown[0]?.();
  expect(reopen).toHaveBeenCalledTimes(1);
  rerender(api(1, [], reopen));
  expect(shown).toHaveLength(1);
});

test("closing the same target twice shows two toasts", () => {
  shown.length = 0;
  const { rerender } = renderHook((props: TabsApi) => useClosedTabToast(props), {
    initialProps: api(0, []),
  });
  rerender(api(1, [target]));
  rerender(api(2, [target, target]));
  expect(shown).toHaveLength(2);
});
