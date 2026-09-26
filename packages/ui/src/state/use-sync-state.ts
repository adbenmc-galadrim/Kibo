import type { SyncState } from "@kibo/schema";
import { useCallback, useEffect, useState } from "react";
import { client } from "../api";

export type SyncStateView = { state: SyncState | null; error: string | null; reload(): Promise<void> };

export function useSyncState(projectId: string): SyncStateView {
  const [state, setState] = useState<SyncState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setState(await client.rpc({ method: "getSyncState", projectId }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectId]);
  useEffect(() => {
    void reload();
    return client.subscribeIntegrations((e) => {
      if (e.type === "integrations") void reload();
      else if ((e.type === "sync" || e.type === "sync.outbox") && e.projectId === projectId) void reload();
    });
  }, [projectId, reload]);
  return { state, error, reload };
}
