import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { kiboProject } from "../agents/fixtures";
import { siloProject } from "../project-agent/fixtures";
import { PANEL_OPEN_KEY, useProjectAgentPanel } from "./use-project-agent-panel";

const realMatchMedia = window.matchMedia;
const narrowScreen = (matches: boolean) => {
  window.matchMedia = (media: string): MediaQueryList =>
    Object.assign(new EventTarget(), {
      matches,
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    });
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

test("the badge opens the panel on Signaux, the button on Conversation", () => {
  const { result } = renderHook(() => useProjectAgentPanel(kiboProject()));
  act(() => result.current.show("signals"));
  expect([result.current.open, result.current.tab]).toEqual([true, "signals"]);
  act(() => result.current.toggle());
  expect(result.current.open).toBe(false);
  act(() => result.current.toggle());
  expect([result.current.open, result.current.tab]).toEqual([true, "conversation"]);
});

test("a read-only project never opens the panel nor touches the preference", () => {
  const { result } = renderHook(() => useProjectAgentPanel(siloProject("read-only")));
  act(() => result.current.show("signals"));
  act(() => result.current.toggle());
  expect(result.current.open).toBe(false);
  expect(localStorage.getItem(PANEL_OPEN_KEY)).toBeNull();
});

test("under 1180 px the panel starts closed, even if it was left open, and opening it keeps the wide preference", () => {
  localStorage.setItem(PANEL_OPEN_KEY, "1");
  narrowScreen(true);
  const { result } = renderHook(() => useProjectAgentPanel(kiboProject()));
  expect(result.current.open).toBe(false);
  act(() => result.current.toggle());
  expect(result.current.open).toBe(true);
  act(() => result.current.close());
  expect(result.current.open).toBe(false);
  expect(localStorage.getItem(PANEL_OPEN_KEY)).toBe("1");
});
