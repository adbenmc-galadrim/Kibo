import { AppSettings, type AppSettingsPatch } from "@kibo/schema";
import type { KiboClient } from "@kibo/sdk";
import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import type { AppSettingsSource, AppSettingsStore } from "./app-settings";

export const fixedStore = (settings: AppSettings): AppSettingsStore => ({
  get: () => settings,
  subscribe: () => () => undefined,
  update: (patch: AppSettingsPatch) => Promise.resolve({ ...settings, ...patch }),
});

const StoreContext = createContext<AppSettingsStore>(fixedStore({ agentExecution: "hidden" }));

export function clientSettingsSource(client: Pick<KiboClient, "rpc" | "subscribeTopic">): AppSettingsSource {
  return {
    getAppSettings: async () => AppSettings.parse(await client.rpc({ method: "getAppSettings" })),
    setAppSettings: async (patch) => AppSettings.parse(await client.rpc({ method: "setAppSettings", patch })),
    subscribeConfig: (listener) => client.subscribeTopic("config", listener),
  };
}

export function AppSettingsProvider({ store, children }: { store: AppSettingsStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export const useAppSettingsStore = (): AppSettingsStore => useContext(StoreContext);

export function useAppSettings(): AppSettings {
  const store = useAppSettingsStore();
  return useSyncExternalStore(store.subscribe, store.get);
}

export const useExecutionShown = (): boolean => useAppSettings().agentExecution === "shown";
