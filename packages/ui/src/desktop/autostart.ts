export type AutostartPort = {
  isEnabled(): Promise<boolean>;
  enable(): Promise<void>;
  disable(): Promise<void>;
};

type Plugin = Pick<typeof import("@tauri-apps/plugin-autostart"), "isEnabled" | "enable" | "disable">;

const loadPlugin = (): Promise<Plugin> => import("@tauri-apps/plugin-autostart");

export function createTauriAutostart(load: () => Promise<Plugin> = loadPlugin): AutostartPort {
  return {
    isEnabled: async () => (await load()).isEnabled(),
    enable: async () => (await load()).enable(),
    disable: async () => (await load()).disable(),
  };
}
