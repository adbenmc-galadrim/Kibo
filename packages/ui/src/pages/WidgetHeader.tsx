import type { Instance, Layout, Page, ProjectSnapshot } from "@kibo/schema";
import { lazyPanel } from "@kibo/sdk";
import type { RefObject } from "react";
import { fr } from "../i18n/fr";
import { instanceFormat } from "../lib/format-grid";
import type { InstanceApis } from "../lib/instance-capabilities";
import { componentIcon } from "../registry";
import { canEdit } from "../state/access";
import { InstanceFrame } from "./InstanceFrame";
import { InstanceMenu } from "./InstanceMenu";

type HeaderProps = { projectId: string; instance: Instance; editable: boolean };

const FullscreenButton = lazyPanel(() => import("./FocusBar").then((m) => m.FullscreenButton), fr.lazy, {
  fallback: "sr-only",
});

export function WidgetHeader({
  projectId,
  instance,
  editable,
  title,
  fullscreen,
}: HeaderProps & { title: string; fullscreen: boolean }) {
  const Icon = componentIcon(instance.component);
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{title}</span>
      {fullscreen && <FullscreenButton instanceId={instance.id} />}
      {editable && <InstanceMenu projectId={projectId} instance={instance} title={title} />}
    </div>
  );
}

export type BodyProps = {
  project: ProjectSnapshot;
  page: Page;
  instance: Instance;
  layout: Layout;
  viewer: string;
};

export function WidgetBody({
  project,
  page,
  instance,
  layout,
  viewer,
  apis,
  containerRef,
}: BodyProps & { apis: InstanceApis; containerRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={containerRef} className="@container min-h-0 flex-1 overflow-auto">
      <InstanceFrame
        projectId={project.meta.id}
        instance={instance}
        viewer={viewer}
        surface="widget"
        format={instanceFormat({ ...instance, layout }, page)}
        apis={apis}
        editable={canEdit(project)}
      />
    </div>
  );
}
