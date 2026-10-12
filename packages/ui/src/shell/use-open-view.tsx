import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { viewPageFor } from "../pages/view-page";
import { componentRef, findBuiltin } from "../registry";
import { OpenViewDialog } from "./lazy-dialogs";

type Pending = { projectId: string; componentId: string; question: string | null };
export type OpenView = {
  openView(componentId: string, projectId?: string, question?: string): void;
  dialog: ReactNode;
};

const pageTarget = (projectId: string, pageId: string, question: string | null): TabTarget => ({
  kind: "page",
  projectId,
  pageId,
  ...(question !== null && { question }),
});

export function useOpenView(
  current: () => ProjectSnapshot | null,
  go: (target: TabTarget) => void,
  snapshotOf: (projectId: string) => ProjectSnapshot | null = () => null,
): OpenView {
  const [pending, setPending] = useState<Pending | null>(null);
  const openView = useCallback(
    (componentId: string, projectId?: string, question?: string) => {
      const project = projectId === undefined ? current() : snapshotOf(projectId);
      const id = projectId ?? project?.meta.id;
      if (id === undefined) return;
      const page = project && viewPageFor(project, componentId);
      if (page) go(pageTarget(id, page.id, question ?? null));
      else if (findBuiltin(componentId))
        setPending({ projectId: id, componentId, question: question ?? null });
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
      onCreated={(pageId) => go(pageTarget(pending.projectId, pageId, pending.question))}
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
