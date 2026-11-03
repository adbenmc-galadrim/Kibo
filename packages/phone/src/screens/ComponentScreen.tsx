import type { ProjectSnapshot } from "@kibo/schema";
import { type ComponentModule, createSdk, projectBackend, SdkProvider } from "@kibo/sdk";
import { client } from "@kibo/ui/api";
import { useHost } from "@kibo/ui/host";
import { projectSnapshotSource } from "@kibo/ui/project-store";
import { useMemo, useRef } from "react";
import { fr } from "../i18n/fr";
import { instanceFor } from "../instance-of";
import { useProjectSnapshot } from "../use-project";

function useSameContent<T>(value: T): T {
  const kept = useRef(value);
  if (JSON.stringify(kept.current) !== JSON.stringify(value)) kept.current = value;
  return kept.current;
}

type Props = { projectId: string; module: ComponentModule };

function Mounted({ projectId, module, snapshot }: Props & { snapshot: ProjectSnapshot }) {
  const host = useHost();
  const instance = useSameContent(instanceFor(snapshot, module.manifest));
  const viewer = snapshot.viewer ?? "";
  const sdk = useMemo(
    () =>
      createSdk(
        projectBackend(client, projectId, instance.id, { snapshotSource: projectSnapshotSource(projectId) }),
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
          openFile: () => undefined,
          openView: (componentId) => host.openView(componentId),
        },
        "builtin",
      ),
    [module, projectId, instance, viewer, host],
  );
  return (
    <SdkProvider sdk={sdk}>
      <module.Component />
    </SdkProvider>
  );
}

export function ComponentScreen({ projectId, module }: Props) {
  const snapshot = useProjectSnapshot(projectId);
  if (!snapshot) return <p className="p-4 text-[15px] text-(--tracking-mfg)">{fr.loading}</p>;
  return <Mounted projectId={projectId} module={module} snapshot={snapshot} />;
}
