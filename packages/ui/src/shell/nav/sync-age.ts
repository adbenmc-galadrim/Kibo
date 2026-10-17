import type { AgentExecution, SyncStatus } from "@kibo/schema";
import { fr } from "../../i18n/fr";
import { relativeTime } from "../../lib/relative-time";

function inactiveLabel(status: SyncStatus, projectId: string): string | null {
  const project = status.projects.find((p) => p.projectId === projectId);
  if (status.state === "online")
    return project && project.lastError !== null && !project.accessRevoked ? fr.nav.syncError : null;
  return status.lastError === null || status.lastError === "SYNC_OFFLINE"
    ? fr.nav.syncOffline
    : fr.nav.syncError;
}

export function syncAge(
  status: SyncStatus | null,
  projectId: string,
  now: number,
  execution: AgentExecution,
): string | null {
  if (status === null) return null;
  const inactive = execution === "hidden" ? inactiveLabel(status, projectId) : null;
  if (inactive !== null) return inactive;
  const at = status.projects.find((p) => p.projectId === projectId)?.lastSyncAt ?? null;
  return at === null ? null : relativeTime(at, now);
}
