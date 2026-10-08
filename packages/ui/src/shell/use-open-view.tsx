import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { viewPageFor } from "../pages/view-page";
import { componentRef, findBuiltin } from "../registry";
import { OpenViewDialog } from "./lazy-dialogs";

type Pending = { projectId: string; componentId: string };
export type OpenView = { openView(componentId: string, projectId?: string): void; dialog: ReactNode };

export function useOpenView(
  current: () => ProjectSnapshot | null,
  go: (target: TabTarget) => void,
  snapshotOf: (projectId: string) => ProjectSnapshot | null = () => null,
): OpenView {
  const [pending, setPending] = useState<Pending | null>(null);
  const openView = useCallback(
    (componentId: string, projectId?: string) => {
      const project = projectId === undefined ? current() : snapshotOf(projectId);
      const id = projectId ?? project?.meta.id;
      if (id === undefined) return;
      const page = project && viewPageFor(project, componentId);
      if (page) go({ kind: "page", projectId: id, pageId: page.id });
      else if (findBuiltin(componentId)) setPending({ projectId: id, componentId });
    },
    [current, go, snapshotOf],
  );
  const target = pending && findBuiltin(pending.componentId);
  const dialog = pending && target && (
    <OpenViewDialog
      projectId={pending.projectId}
      componentRef={componentRef(target.manifest)}
      title={target.manifest.title}
      open
      onOpenChange={(open) => !open && setPending(null)}
      onCreated={(pageId) => go({ kind: "page", projectId: pending.projectId, pageId })}
    />
  );
  return { openView, dialog };
}

export function useSnapshotLookup(
  snapshots: ReadonlyMap<string, ProjectSnapshot>,
): (projectId: string) => ProjectSnapshot | null {
  const latest = useRef(snapshots);
  useEffect(() => {
    latest.current = snapshots;
  }, [snapshots]);
  return useCallback((projectId: string) => latest.current.get(projectId) ?? null, []);
}
