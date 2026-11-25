import { manifest } from "@kibo/component-graph";
import { splitRef } from "@kibo/schema";
import { createSdk, type KiboClient, type KiboSdk, projectBackend } from "@kibo/sdk";
import { useHost } from "@kibo/ui/host";
import { projectSnapshotSource } from "@kibo/ui/project-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { useProjectSnapshot } from "../../use-project";

function useViewer(client: KiboClient): string {
  const [viewer, setViewer] = useState("");
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

const isGraph = (ref: string): boolean => splitRef(ref).id === manifest.id;

export function useGraphSdk(projectId: string, client: KiboClient): KiboSdk | null {
  const snapshot = useProjectSnapshot(projectId);
  const host = useHost();
  const hostRef = useRef(host);
  hostRef.current = host;
  const viewer = useViewer(client);
  const instance = snapshot?.instances.find((i) => isGraph(i.component)) ?? null;
  const instanceId = instance?.id ?? `phone:${manifest.id}`;
  const configKey = JSON.stringify(instance?.config ?? {});
  const ready = snapshot !== null;
  return useMemo(() => {
    if (!ready) return null;
    const config: Record<string, unknown> = JSON.parse(configKey);
    return createSdk(
      projectBackend(client, projectId, instanceId, { snapshotSource: projectSnapshotSource(projectId) }),
      manifest,
      {
        instanceId,
        config,
        viewer,
        surface: "view",
        format: "full",
        openTicket: (id) => hostRef.current.openTicket(id),
        openSprint: (id) => hostRef.current.openSprint?.(id),
        openNewTicket: (defaults) => hostRef.current.openNewTicket(defaults),
        openFile: () => undefined,
        openView: (componentId) => hostRef.current.openView(componentId),
      },
      "builtin",
    );
  }, [ready, client, projectId, instanceId, configKey, viewer]);
}
