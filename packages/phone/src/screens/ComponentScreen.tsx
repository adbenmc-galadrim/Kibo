import type { ProjectSnapshot } from "@kibo/schema";
import { type ComponentModule, createSdk, projectBackend, SdkProvider } from "@kibo/sdk";
import { useHost } from "@kibo/ui/host";
import { projectSnapshotSource } from "@kibo/ui/project-store";
import { useMemo, useRef } from "react";
import { fr } from "../i18n/fr";
import { instanceFor } from "../instance-of";
import type { RemoteClient } from "../remote-client";
import { useProjectSnapshot } from "../use-project";
import { useViewer } from "../use-viewer";

function useSameContent<T>(value: T): T {
  const kept = useRef(value);
  if (JSON.stringify(kept.current) !== JSON.stringify(value)) kept.current = value;
  return kept.current;
}

type Props = { client: RemoteClient; projectId: string; module: ComponentModule };

function Mounted({
  client,
  projectId,
  module,
  snapshot,
  viewer,
}: Props & { snapshot: ProjectSnapshot; viewer: string }) {
  const host = useHost();
  const instance = useSameContent(instanceFor(snapshot, module.manifest));
  const sdk = useMemo(
    () =>
      createSdk(
        projectBackend(client, projectId, instance.id, {
          snapshotSource: projectSnapshotSource(projectId),
          imageUrl: (questionId, imageId) => client.imageUrl(projectId, questionId, imageId),
        }),
        module.manifest,
        {
          instanceId: instance.id,
          config: instance.config,
          viewer,
          surface: "view",
          format: "full",
          openTicket: host.openTicket,
          openSprint: host.openSprint,
          editProject: host.editProject,
          openNewTicket: host.openNewTicket,
          openFile: (ref) =>
            host.openFile({
              projectId,
              worktree: null,
              path: ref.path,
              line: ref.line ?? null,
              origin: ref.origin ?? null,
            }),
          openView: (componentId) => host.openView(componentId),
        },
        "builtin",
      ),
    [client, module, projectId, instance, viewer, host],
  );
  return (
    <SdkProvider sdk={sdk}>
      <module.Component />
    </SdkProvider>
  );
}

export function ComponentScreen(props: Props) {
  const snapshot = useProjectSnapshot(props.projectId);
  const { viewer, failed } = useViewer(props.client);
  if (failed)
    return (
      <p role="alert" className="p-4 text-[15px] text-(--tracking-red)">
        {fr.sessionFailed}
      </p>
    );
  if (!snapshot || viewer === null)
    return <p className="p-4 text-[15px] text-(--tracking-mfg)">{fr.loading}</p>;
  return (
    <div className="h-full">
      <Mounted {...props} snapshot={snapshot} viewer={snapshot.viewer ?? viewer} />
    </div>
  );
}
