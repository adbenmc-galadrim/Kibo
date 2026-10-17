import { useNow } from "../../state/use-agents";
import { useAppSettings } from "../../state/use-app-settings";
import { useSyncServerStatus } from "../../state/use-sync-server";
import { syncChipText, syncState } from "./sync-age";

export function SyncLabel({ projectId }: { projectId: string; children?: string }) {
  const { status } = useSyncServerStatus();
  const execution = useAppSettings().agentExecution;
  const { label, age } = syncChipText(syncState(status, projectId, useNow(30_000), execution));
  return (
    <>
      {label}
      {age && <span> · {age}</span>}
    </>
  );
}
