import { useSyncExternalStore } from "react";
import { client } from "../api";
import { createTauriUpdaterPort } from "./tauri-updater";
import { scheduleUpdateChecks } from "./update-schedule";
import { createUpdateStore, type UpdateSnapshot, type UpdateStore } from "./update-store";

const backupBeforeUpdate = () =>
  client.rpc({ method: "createBackup", reason: "update" }).then(() => undefined);

export const updateStore: UpdateStore = createUpdateStore(createTauriUpdaterPort(backupBeforeUpdate));

export function useUpdateSnapshot(store: UpdateStore = updateStore): UpdateSnapshot {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}

export function startUpdateSchedule(store: UpdateStore = updateStore): () => void {
  return scheduleUpdateChecks(() => void store.check());
}
