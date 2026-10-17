import type { AgentExecution, SyncStatus } from "@kibo/schema";
import { fr } from "../../i18n/fr";
import { relativeTime } from "../../lib/relative-time";

export type SyncState = { kind: "synced"; age: string | null } | { kind: "offline" } | { kind: "error" };

function inactiveState(status: SyncStatus, projectId: string): SyncState | null {
  const project = status.projects.find((p) => p.projectId === projectId);
  if (status.state === "online")
    return project && project.lastError !== null && !project.accessRevoked ? { kind: "error" } : null;
  return status.lastError === null || status.lastError === "SYNC_OFFLINE"
    ? { kind: "offline" }
    : { kind: "error" };
}

export function syncState(
  status: SyncStatus | null,
  projectId: string,
  now: number,
  execution: AgentExecution,
): SyncState {
  if (status === null) return { kind: "synced", age: null };
  const inactive = execution === "hidden" ? inactiveState(status, projectId) : null;
  if (inactive !== null) return inactive;
  const at = status.projects.find((p) => p.projectId === projectId)?.lastSyncAt ?? null;
  return { kind: "synced", age: at === null ? null : relativeTime(at, now) };
}

const LABELS: Record<SyncState["kind"], string> = {
  synced: fr.nav.synced,
  offline: fr.nav.syncOffline,
  error: fr.nav.syncError,
};

export const syncChipText = (state: SyncState): { label: string; age: string | null } => ({
  label: LABELS[state.kind],
  age: state.kind === "synced" ? state.age : null,
});
