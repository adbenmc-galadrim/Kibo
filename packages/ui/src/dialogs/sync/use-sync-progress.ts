import { useEffect, useState } from "react";
import { client } from "../../api";

export type SyncProgress = { imported: number; running: boolean };

export function useSyncProgress(bindingId: string | null): SyncProgress | null {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  useEffect(() => {
    setProgress(null);
    if (bindingId === null) return;
    return client.subscribeIntegrations((e) => {
      if (e.type === "sync" && e.bindingId === bindingId)
        setProgress({ imported: e.imported, running: e.running });
    });
  }, [bindingId]);
  return progress;
}
