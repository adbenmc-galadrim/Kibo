import { Component, manifest } from "@kibo/component-questions";
import { configDefaults, type ProjectSnapshot } from "@kibo/schema";
import { createSdk, projectBackend, SdkProvider } from "@kibo/sdk";
import { useHost } from "@kibo/ui/host";
import { projectSnapshotSource } from "@kibo/ui/project-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { fr } from "../../i18n/fr";
import type { RemoteClient } from "../../remote-client";
import { useProjectSnapshot } from "../../use-project";

type Props = { client: RemoteClient; projectId: string };

const SYNTHETIC_INSTANCE = `phone:${manifest.id}`;

type MountedInstance = { id: string; config: Record<string, unknown> };

function questionsInstance(snapshot: ProjectSnapshot): MountedInstance {
  const found = snapshot.instances.find((i) => i.component.split("@")[0] === manifest.id);
  if (found) return { id: found.id, config: found.config };
  return { id: SYNTHETIC_INSTANCE, config: configDefaults(manifest.configSchema) };
}

function useSameContent<T>(value: T): T {
  const kept = useRef(value);
  if (JSON.stringify(kept.current) !== JSON.stringify(value)) kept.current = value;
  return kept.current;
}

function useViewer(client: RemoteClient): string | null {
  const [viewer, setViewer] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    client.rpc({ method: "getSession" }).then(
      (session) => alive && setViewer(session.user),
      (e: unknown) => console.error("[kibo-phone] session read failed", e),
    );
    return () => {
      alive = false;
    };
  }, [client]);
  return viewer;
}

export function QuestionsScreen({ client, projectId }: Props) {
  const host = useHost();
  const snapshot = useProjectSnapshot(projectId);
  const viewer = useViewer(client);
  const instance = useSameContent(snapshot ? questionsInstance(snapshot) : null);
  const sdk = useMemo(() => {
    if (instance === null || viewer === null) return null;
    return createSdk(
      projectBackend(client, projectId, instance.id, {
        snapshotSource: projectSnapshotSource(projectId),
        imageUrl: (questionId, imageId) => client.imageUrl(projectId, questionId, imageId),
      }),
      manifest,
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
    );
  }, [client, projectId, instance, viewer, host]);
  if (sdk === null) return <p className="p-4 text-[15px] text-(--tracking-mfg)">{fr.loading}</p>;
  return (
    <div className="h-full">
      <SdkProvider sdk={sdk}>
        <Component />
      </SdkProvider>
    </div>
  );
}
