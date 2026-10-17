import { useNow } from "../../state/use-agents";
import { useAppSettings } from "../../state/use-app-settings";
import { useSyncServerStatus } from "../../state/use-sync-server";
import { syncAge } from "./sync-age";

export function SyncAge({ projectId }: { projectId: string }) {
  const { status } = useSyncServerStatus();
  const execution = useAppSettings().agentExecution;
  const age = syncAge(status, projectId, useNow(30_000), execution);
  return age ? <span> · {age}</span> : null;
}
