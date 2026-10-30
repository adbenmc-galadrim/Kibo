import type { AppSettings, AppSettingsPatch } from "@kibo/schema";

export const DEFAULT_APP_SETTINGS: AppSettings = {};

export type AppSettingsSource = {
  getAppSettings(): Promise<AppSettings>;
  setAppSettings(patch: AppSettingsPatch): Promise<AppSettings>;
  subscribeConfig(listener: () => void): () => void;
};

export type AppSettingsStore = {
  get(): AppSettings;
  subscribe(listener: () => void): () => void;
  update(patch: AppSettingsPatch): Promise<AppSettings>;
};

const reportError = (e: unknown) => console.error("[kibo-ui] app settings unavailable", e);

export function createAppSettingsStore(source: AppSettingsSource, onError = reportError): AppSettingsStore {
  let current = DEFAULT_APP_SETTINGS;
  let stop: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: AppSettings) => {
    current = next;
    for (const l of listeners) l();
    return next;
  };
  const load = () => void source.getAppSettings().then(publish, onError);
  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      if (!stop) {
        stop = source.subscribeConfig(load);
        load();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && stop) {
          stop();
          stop = null;
        }
      };
    },
    update: (patch) => source.setAppSettings(patch).then(publish),
  };
}
