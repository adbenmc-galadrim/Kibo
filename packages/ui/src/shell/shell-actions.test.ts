import { expect, mock, test } from "bun:test";
import type { FileRef, TabTarget } from "@kibo/schema";
import { targetToHash } from "../tabs/target-hash";
import type { DialogsState } from "./ShellDialogs";
import { fileTabOpener, paletteActionHandler } from "./shell-actions";

function paletteDeps(activeProjectId: string | null) {
  const calls: string[] = [];
  const deps = {
    activeProjectId,
    set: mock((patch: Partial<DialogsState>) => calls.push(`set ${JSON.stringify(patch)}`)),
    setFocusRun: mock((id: string | null) => calls.push(`focus ${id}`)),
    go: mock((target: TabTarget | null) => calls.push(`go ${JSON.stringify(target)}`)),
    cycleTheme: mock(() => calls.push("theme")),
  };
  return { deps, calls };
}

test("newProject opens the new project dialog", () => {
  const { deps, calls } = paletteDeps("p1");
  paletteActionHandler(deps)({ kind: "newProject" });
  expect(calls).toEqual(['set {"newProject":true}']);
});

test("theme, reply and assign need no navigation", () => {
  const { deps, calls } = paletteDeps(null);
  const handle = paletteActionHandler(deps);
  handle({ kind: "toggleTheme" });
  handle({ kind: "reply", runId: "r1" });
  handle({ kind: "assign", projectId: "p2", ticketId: "t1" });
  expect(calls).toEqual(["theme", "focus r1", 'set {"assign":{"projectId":null,"ticketId":"t1"}}']);
});

test("newTicket on another project opens that project first", () => {
  const { deps, calls } = paletteDeps("p1");
  paletteActionHandler(deps)({ kind: "newTicket", projectId: "p2", parentId: "7@1" });
  expect(calls).toEqual(['go {"kind":"project","projectId":"p2"}', 'set {"newTicket":{"parentId":"7@1"}}']);
});

test("newPage on the active project stays put", () => {
  const { deps, calls } = paletteDeps("p1");
  paletteActionHandler(deps)({ kind: "newPage", projectId: "p1" });
  expect(calls).toEqual(['set {"newPageParent":null}']);
});

const ref: FileRef = { projectId: "p1", worktree: null, path: "src/a.ts", line: 3, origin: null };
const target: TabTarget = { kind: "file", projectId: "p1", worktree: null, path: "src/a.ts", line: 3 };

test("openFileTab in edit mode records the request, closes the preview and opens a new tab", () => {
  const editRequests = new Set<string>();
  const set = mock((_: Partial<DialogsState>) => {});
  const go = mock((_: TabTarget | null, __?: boolean) => {});
  fileTabOpener({ editRequests, set, go })(ref, true);
  expect([...editRequests]).toEqual([targetToHash(target)]);
  expect(set).toHaveBeenCalledWith({ preview: null });
  expect(go).toHaveBeenCalledWith(target, true);
});

test("openFileTab to read records nothing", () => {
  const editRequests = new Set<string>();
  fileTabOpener({ editRequests, set: () => {}, go: () => {} })(ref, false);
  expect(editRequests.size).toBe(0);
});
