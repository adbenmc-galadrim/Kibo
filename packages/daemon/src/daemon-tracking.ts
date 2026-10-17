import type { Clock } from "./clock";
import { migrateTracking } from "./migrations/tracking";
import { createProjectSettings } from "./notes/settings";
import type { RpcExtension } from "./rpc-extensions";
import type { Service } from "./service";
import { appSettingsRpc } from "./settings/app-settings-rpc";
import { type AppSettingsStore, createAppSettingsStore } from "./settings/app-settings-store";
import type { Store } from "./store";

export type DaemonTracking = { rpc: RpcExtension; appSettings: AppSettingsStore };

export function startDaemonTracking(store: Store, service: Service, clock: Clock): DaemonTracking {
  const settings = createProjectSettings(store.db);
  migrateTracking({ docs: service.docs, settings, log: console.error, now: clock.now });
  const appSettings = createAppSettingsStore(store.db, clock.now);
  const rpc = appSettingsRpc({ store: appSettings, emit: (message) => service.docs.emit(message) });
  return { rpc, appSettings };
}
