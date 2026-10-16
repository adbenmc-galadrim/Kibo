import type { SyncStatus } from "@kibo/schema";
import { relativeTime } from "../../lib/relative-time";

export function syncAge(status: SyncStatus | null, projectId: string, now: number): string | null {
  const at = status?.projects.find((p) => p.projectId === projectId)?.lastSyncAt ?? null;
  return at === null ? null : relativeTime(at, now);
}
