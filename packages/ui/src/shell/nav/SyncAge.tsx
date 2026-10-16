import { useNow } from "../../state/use-agents";
import { useSyncServerStatus } from "../../state/use-sync-server";
import { syncAge } from "./sync-age";

export function SyncAge({ projectId }: { projectId: string }) {
  const { status } = useSyncServerStatus();
  const age = syncAge(status, projectId, useNow(30_000));
  return age ? <span> · {age}</span> : null;
}
