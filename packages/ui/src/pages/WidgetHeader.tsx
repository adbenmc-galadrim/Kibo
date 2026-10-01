import {
  type Instance,
  isBuiltinId,
  type Layout,
  type Page,
  type ProjectSnapshot,
  splitRef,
} from "@kibo/schema";
import { readSource } from "@kibo/sdk";
import { instanceFormat } from "../lib/format-grid";
import { componentIcon } from "../registry";
import { SourceHeader } from "../shell/lazy-screens";
import { PageActions } from "../shell/page-actions";
import { InstanceFrame } from "./InstanceFrame";
import { InstanceMenu, useInstanceTitle } from "./InstanceMenu";
import { instanceTitle } from "./instance-title";

type HeaderProps = { projectId: string; instance: Instance; editable: boolean };

export function WidgetHeader({ projectId, instance, editable }: HeaderProps) {
  const Icon = componentIcon(instance.component);
  const title = instanceTitle(instance, useInstanceTitle(instance.component));
  const { id, version } = splitRef(instance.component);
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {isBuiltinId(id) ? title : `${title} · ${version}`}
      </span>
      {editable && <InstanceMenu projectId={projectId} instance={instance} title={title} />}
    </div>
  );
}

export function ViewActions({ projectId, instance, editable }: HeaderProps) {
  const title = useInstanceTitle(instance.component);
  if (!editable) return null;
  return (
    <PageActions>
      <InstanceMenu projectId={projectId} instance={instance} title={title} />
    </PageActions>
  );
}

type BodyProps = { project: ProjectSnapshot; page: Page; instance: Instance; layout: Layout; viewer: string };

export function WidgetBody({ project, page, instance, layout, viewer }: BodyProps) {
  return (
    <>
      {readSource(instance.config) && <SourceHeader project={project} instance={instance} />}
      <div className="@container min-h-0 flex-1 overflow-auto">
        <InstanceFrame
          projectId={project.meta.id}
          instance={instance}
          viewer={viewer}
          surface="widget"
          format={instanceFormat({ ...instance, layout }, page)}
        />
      </div>
    </>
  );
}
