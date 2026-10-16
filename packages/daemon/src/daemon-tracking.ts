import { migrateTracking } from "./migrations/tracking";
import { createProjectSettings } from "./notes/settings";
import type { RpcExtension } from "./rpc-extensions";
import type { Service } from "./service";
import { appSettingsRpc } from "./settings/app-settings-rpc";
import { createAppSettingsStore } from "./settings/app-settings-store";
import type { Store } from "./store";

export function startDaemonTracking(store: Store, service: Service): { rpc: RpcExtension } {
  const settings = createProjectSettings(store.db);
  migrateTracking({ docs: service.docs, settings, log: console.error, now: Date.now });
  const appSettings = createAppSettingsStore(store.db, Date.now);
  return { rpc: appSettingsRpc({ store: appSettings, emit: (message) => service.docs.emit(message) }) };
}
