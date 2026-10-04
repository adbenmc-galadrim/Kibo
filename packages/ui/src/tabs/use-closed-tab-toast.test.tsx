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
const api = (closed: TabTarget[], reopen = () => {}): TabsApi => ({
  state: EMPTY_TABS,
  error: null,
  dispatch: () => {},
  open: () => {},
  closed,
  reopen,
});

test("a new closed target shows the toast once, and its action reopens", () => {
  const reopen = mock(() => {});
  const { rerender } = renderHook((props: TabsApi) => useClosedTabToast(props), {
    initialProps: api([], reopen),
  });
  expect(shown).toHaveLength(0);
  rerender(api([target], reopen));
  expect(shown).toHaveLength(1);
  rerender(api([target], reopen));
  expect(shown).toHaveLength(1);
  shown[0]?.();
  expect(reopen).toHaveBeenCalledTimes(1);
  rerender(api([], reopen));
  expect(shown).toHaveLength(1);
});

test("a close with a full pile shows the toast, a reopen does not", () => {
  shown.length = 0;
  const pile = (n: number): TabTarget[] =>
    Array.from({ length: n }, (_, i) => ({ kind: "page", projectId: "p", pageId: `${i}` }));
  const full = pile(10);
  const { rerender } = renderHook((props: TabsApi) => useClosedTabToast(props), {
    initialProps: api(full),
  });
  rerender(api([target, ...full.slice(0, 9)]));
  expect(shown).toHaveLength(1);
  rerender(api(full.slice(0, 9)));
  expect(shown).toHaveLength(1);
});
