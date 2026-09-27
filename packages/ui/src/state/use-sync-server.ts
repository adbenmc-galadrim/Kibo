import type { KiboError, SyncStatus } from "@kibo/schema";
import { useRpcQuery } from "./use-rpc-query";

export type SyncServerState = { status: SyncStatus | null; error: KiboError | null; reload(): void };

export function useSyncServerStatus(): SyncServerState {
  const { data, error, reload } = useRpcQuery({ method: "getSyncStatus" }, ["collab.changed"]);
  return { status: data, error, reload };
}
