import { expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import type { DialogsState } from "./dialogs-state";
import { useWorkspaceHost } from "./use-workspace-host";

function host(activeProjectId: string | null) {
  const patches: Partial<DialogsState>[] = [];
  const { result } = renderHook(() =>
    useWorkspaceHost({
      activeProjectId,
      projectRef: { current: null },
      set: (patch) => patches.push(patch),
      go: () => {},
      openView: () => {},
      showProjectAgent: () => {},
    }),
  );
  return { host: result.current, patches };
}

test("a sprint opened by a component opens the sprint sheet of the active project", () => {
  const active = host("silo");
  active.host.openSprint?.("s42");
  expect(active.patches).toEqual([{ sprintSheet: { projectId: "silo", sprintId: "s42" } }]);
  const none = host(null);
  none.host.openSprint?.("s42");
  expect(none.patches).toEqual([]);
});

test("a component asks to edit the project on its folder field", () => {
  const active = host("silo");
  active.host.editProject?.({ field: "folder" });
  expect(active.patches).toEqual([{ editProject: "silo", editFocus: "folder" }]);
  const none = host(null);
  none.host.editProject?.({ field: "folder" });
  expect(none.patches).toEqual([]);
});
