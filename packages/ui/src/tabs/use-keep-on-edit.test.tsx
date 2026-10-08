import { expect, mock, test } from "bun:test";
import type { TabsState } from "@kibo/schema";
import { renderHook } from "@testing-library/react";
import type { TabsAction } from "./tabs-model";
import type { TabsApi } from "./use-tabs";

type Listener = (projectId: string | null) => void;
let listener: Listener | null = null;
mock.module("../api", () => ({
  client: { rpc: () => Promise.resolve(null) },
  onWrite: (l: Listener) => {
    listener = l;
    return () => {
      listener = null;
    };
  },
}));
const { useKeepOnEdit } = await import("./use-keep-on-edit");

const state = (preview: boolean): TabsState => ({
  tabs: [{ id: "t1", target: { kind: "page", projectId: "p1", pageId: "1@2" }, pinned: false, preview }],
  activeId: "t1",
  recents: [],
});
const api = (s: TabsState, dispatched: TabsAction[]): TabsApi => ({
  state: s,
  error: null,
  dispatch: (a) => {
    dispatched.push(a);
  },
  open: () => {},
  closed: [],
  reopen: () => {},
});

test("a write in the preview's project keeps it, unless a dialog is open or the project differs", () => {
  const dispatched: TabsAction[] = [];
  const first = renderHook(() => useKeepOnEdit(api(state(true), dispatched), false));
  listener?.("p2");
  expect(dispatched).toEqual([]);
  listener?.("p1");
  expect(dispatched).toEqual([{ type: "keep", id: "t1" }]);
  first.unmount();
  const withDialog: TabsAction[] = [];
  const second = renderHook(() => useKeepOnEdit(api(state(true), withDialog), true));
  listener?.("p1");
  expect(withDialog).toEqual([]);
  second.unmount();
  const permanent: TabsAction[] = [];
  renderHook(() => useKeepOnEdit(api(state(false), permanent), false));
  listener?.(null);
  listener?.("p1");
  expect(permanent).toEqual([]);
});

test("a screen preview has no project: no write keeps it", () => {
  const screen: TabsState = {
    tabs: [{ id: "s", target: { kind: "screen", screen: "agents" }, pinned: false, preview: true }],
    activeId: "s",
    recents: [],
  };
  const dispatched: TabsAction[] = [];
  renderHook(() => useKeepOnEdit(api(screen, dispatched), false));
  listener?.("p1");
  listener?.(null);
  expect(dispatched).toEqual([]);
});
