import type { ComponentFormat, Instance, Surface } from "@kibo/schema";
import { type ComponentModule, createSdk, projectBackend, SdkProvider } from "@kibo/sdk";
import { useMemo, useRef } from "react";
import { client } from "../api";
import type { InstanceApis } from "../lib/instance-capabilities";
import { findComponent } from "../registry";
import { useHost } from "../shell/Host";
import { viewSpotlight } from "../shell/view-spotlight";
import { RetiredComponent } from "./RetiredComponent";

type Props = {
  projectId: string;
  instance: Instance;
  viewer: string;
  surface: Surface;
  format: ComponentFormat;
  apis: InstanceApis;
  editable: boolean;
};
type MountedProps = Omit<Props, "editable"> & { mod: ComponentModule };

function useSameContent<T>(value: T): T {
  const kept = useRef(value);
  if (JSON.stringify(kept.current) !== JSON.stringify(value)) kept.current = value;
  return kept.current;
}

function Mounted({ projectId, instance, viewer, surface, format, mod, apis }: MountedProps) {
  const host = useHost();
  const config = useSameContent(instance.config);
  const { focus, visibility, selection, spotlight } = apis;
  const sdk = useMemo(
    () =>
      createSdk(
        projectBackend(client, projectId, instance.id),
        mod.manifest,
        {
          instanceId: instance.id,
          config,
          viewer,
          surface,
          format,
          openTicket: host.openTicket,
          openSprint: host.openSprint,
          editProject: host.editProject,
          openNewTicket: host.openNewTicket,
          openFile: (r) =>
            host.openFile({
              projectId,
              worktree: null,
              path: r.path,
              line: r.line ?? null,
              origin: r.origin ?? null,
            }),
          openView: (componentId, opts) =>
            host.openView(componentId, undefined, viewSpotlight(opts?.intent, opts?.question)),
          focus,
          visibility,
          selection,
          spotlight,
        },
        "builtin",
      ),
    [
      mod,
      projectId,
      instance.id,
      config,
      viewer,
      surface,
      format,
      host,
      focus,
      visibility,
      selection,
      spotlight,
    ],
  );
  return (
    <SdkProvider sdk={sdk}>
      <mod.Component />
    </SdkProvider>
  );
}

export function InstanceFrame({ editable, ...props }: Props) {
  const ref = props.instance.component;
  const builtin = findComponent(ref);
  if (builtin) return <Mounted {...props} mod={builtin} />;
  return (
    <RetiredComponent
      projectId={props.projectId}
      instanceId={props.instance.id}
      componentRef={ref}
      editable={editable}
      compact={props.surface === "widget"}
    />
  );
}
