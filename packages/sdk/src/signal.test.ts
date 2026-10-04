import { expect, test } from "bun:test";
import type { Selection } from "@kibo/schema";
import { createSignal, focusApi, selectionApi, visibilityApi } from "./signal";

test("a signal notifies on change only", () => {
  const s = createSignal(1);
  let hits = 0;
  const off = s.subscribe(() => hits++);
  s.set(1);
  s.set(2);
  expect(s.get()).toBe(2);
  expect(hits).toBe(1);
  off();
  s.set(3);
  expect(hits).toBe(1);
});

test("the focus api forwards requests and reads the signal", () => {
  const active = createSignal(false);
  const asked: boolean[] = [];
  const focus = focusApi(active, (on) => asked.push(on));
  focus.request();
  focus.exit();
  expect(asked).toEqual([true, false]);
  active.set(true);
  expect(focus.active()).toBe(true);
  const sel = createSignal<Selection | null>(null);
  const seen: unknown[] = [];
  const selection = selectionApi(sel, (s) => seen.push(s));
  selection.set({ kind: "ticket", ids: ["t1"] });
  expect(sel.get()).toEqual({ kind: "ticket", ids: ["t1"] });
  expect(seen).toHaveLength(1);
  expect(visibilityApi(createSignal(false)).visible()).toBe(false);
});
