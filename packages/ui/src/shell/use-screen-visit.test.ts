import { expect, test } from "bun:test";
import type { Screen, TabTarget } from "@kibo/schema";
import { act, renderHook } from "@testing-library/react";
import { useScreenVisit } from "./use-screen-visit";

test("opening the screen already shown from the sidebar starts a new visit, back to its list", () => {
  const opened: (TabTarget | null)[] = [];
  const go = (t: TabTarget | null) => {
    opened.push(t);
  };
  const { result, rerender } = renderHook(({ screen }) => useScreenVisit(screen, go), {
    initialProps: { screen: "agents" as Screen },
  });
  const first = result.current.visit;
  act(() => result.current.open({ kind: "screen", screen: "agents" }, false));
  expect(result.current.visit).not.toBe(first);
  const second = result.current.visit;
  act(() => result.current.open({ kind: "screen", screen: "skills" }, false));
  act(() => result.current.open({ kind: "screen", screen: "agents" }, true));
  rerender({ screen: "agents" });
  expect(result.current.visit).toBe(second);
  expect(opened).toHaveLength(3);
});
