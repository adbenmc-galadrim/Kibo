import { beforeEach, expect, mock, test } from "bun:test";
import type { TabsState, TabTarget } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import { targetToHash } from "./target-hash";
import { useHashSync } from "./use-hash-sync";
import type { TabsApi } from "./use-tabs";

const board: TabTarget = { kind: "page", projectId: "p1", pageId: "board" };
const readme: TabTarget = { kind: "file", projectId: "p1", worktree: "/repo", path: "README.md", line: 1 };

const state = (activeId: string | null, ids: string[]): TabsState => ({
  tabs: ids.map((id) => ({ id, target: id === "board" ? board : readme, pinned: false, preview: false })),
  activeId,
  recents: [],
});

type Props = { tabs: TabsApi; route: TabTarget | null };

const open = mock((_target: TabTarget | null) => {});
const api = (s: TabsState): TabsApi => ({
  state: s,
  error: null,
  dispatch: () => {},
  open,
  closed: [],
  reopen: () => {},
});

beforeEach(() => {
  open.mockClear();
  location.hash = "#/";
});

test("closing a tab before the hash change of its activation lands navigates to the new active tab", () => {
  const initial: Props = { tabs: api(state(null, ["board", "readme"])), route: null };
  const { rerender } = renderHook((p: Props) => useHashSync(p.tabs, p.route), { initialProps: initial });

  rerender({ tabs: api(state("readme", ["board", "readme"])), route: null });
  expect(location.hash).toBe(targetToHash(readme));

  rerender({ tabs: api(state("board", ["board"])), route: readme });

  expect(open).not.toHaveBeenCalled();
  expect(location.hash).toBe(targetToHash(board));
});

test("a hash typed by the user still opens its target", () => {
  const initial: Props = { tabs: api(state("board", ["board"])), route: board };
  const { rerender } = renderHook((p: Props) => useHashSync(p.tabs, p.route), { initialProps: initial });

  rerender({ tabs: api(state("board", ["board"])), route: readme });

  expect(open).toHaveBeenCalledWith(readme);
});
