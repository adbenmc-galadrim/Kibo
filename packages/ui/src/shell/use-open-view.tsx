import type { ProjectSnapshot, TabTarget } from "@kibo/schema";
import { type ReactNode, useCallback, useState } from "react";
import { OpenViewDialog } from "../dialogs/OpenViewDialog";
import { viewPageFor } from "../pages/view-page";
import { componentRef, findBuiltin } from "../registry";

type Pending = { projectId: string; componentId: string };
export type OpenView = { openView(componentId: string): void; dialog: ReactNode };

export function useOpenView(
  current: () => ProjectSnapshot | null,
  go: (target: TabTarget) => void,
): OpenView {
  const [pending, setPending] = useState<Pending | null>(null);
  const openView = useCallback(
    (componentId: string) => {
      const project = current();
      if (!project) return;
      const page = viewPageFor(project, componentId);
      if (page) go({ kind: "page", projectId: project.meta.id, pageId: page.id });
      else if (findBuiltin(componentId)) setPending({ projectId: project.meta.id, componentId });
    },
    [current, go],
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
