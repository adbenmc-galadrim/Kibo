import { beforeEach, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { kiboProject } from "../agents/fixtures";
import { emisProject } from "../project-agent/fixtures";
import { PANEL_OPEN_KEY, useProjectAgentPanel } from "./use-project-agent-panel";

beforeEach(() => localStorage.clear());

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
  const { result } = renderHook(() => useProjectAgentPanel(emisProject("read-only")));
  act(() => result.current.show("signals"));
  act(() => result.current.toggle());
  expect(result.current.open).toBe(false);
  expect(localStorage.getItem(PANEL_OPEN_KEY)).toBeNull();
});
