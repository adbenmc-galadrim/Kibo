import { useSyncExternalStore } from "react";
import { createTauriUpdaterPort } from "./tauri-updater";
import { scheduleUpdateChecks } from "./update-schedule";
import { createUpdateStore, type UpdateSnapshot, type UpdateStore } from "./update-store";

export const updateStore: UpdateStore = createUpdateStore(createTauriUpdaterPort());

export function useUpdateSnapshot(store: UpdateStore = updateStore): UpdateSnapshot {
  return useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
}

export function startUpdateSchedule(store: UpdateStore = updateStore): () => void {
  return scheduleUpdateChecks(() => void store.check());
}
