import { AppSettings, type AppSettingsPatch, KiboError } from "@kibo/schema";

export const DEFAULT_APP_SETTINGS: AppSettings = AppSettings.parse({});

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

type Options = { onError(e: unknown): void };

const reportError = (e: unknown) => {
  if (e instanceof KiboError && e.code === "UNAUTHORIZED") return;
  console.error("[kibo-ui] app settings unavailable", e);
};

export function createAppSettingsStore(
  source: AppSettingsSource,
  { onError }: Options = { onError: reportError },
): AppSettingsStore {
  let current = DEFAULT_APP_SETTINGS;
  const listeners = new Set<() => void>();
  let stop: (() => void) | null = null;

  const publish = (next: AppSettings) => {
    current = next;
    for (const l of listeners) l();
  };
  const load = () => {
    source.getAppSettings().then(publish, onError);
  };

  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      if (stop === null) {
        stop = source.subscribeConfig(load);
        load();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0 || stop === null) return;
        stop();
        stop = null;
      };
    },
    async update(patch) {
      const next = await source.setAppSettings(patch);
      publish(next);
      return next;
    },
  };
}
