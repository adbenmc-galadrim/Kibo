import type { ProjectSnapshot } from "@kibo/schema";
import { projectStore } from "@kibo/ui/project-store";
import { useEffect, useSyncExternalStore } from "react";

export function useProjectSnapshot(projectId: string): ProjectSnapshot | null {
  const view = useSyncExternalStore(projectStore.subscribe, () => projectStore.peek(projectId));
  useEffect(() => {
    const unwatch = projectStore.watch(projectId);
    projectStore
      .ensure(projectId)
      .catch((e: unknown) => console.error("[kibo-phone] project load failed", e));
    return unwatch;
  }, [projectId]);
  return view;
}
