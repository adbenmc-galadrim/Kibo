import type { Database } from "bun:sqlite";

export type SettingKey = "github.mode" | "github.login" | "figma.url";
export type Settings = {
  get(key: SettingKey): string | null;
  set(key: SettingKey, value: string): void;
  delete(key: SettingKey): void;
};

export function createSettings(db: Database): Settings {
  const select = db.query<{ value: string }, { key: SettingKey }>(
    "SELECT value FROM integration_settings WHERE key = $key",
  );
  const upsert = db.query<null, { key: SettingKey; value: string }>(
    "INSERT INTO integration_settings (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const remove = db.query<null, { key: SettingKey }>("DELETE FROM integration_settings WHERE key = $key");
  return {
    get: (key) => select.get({ key })?.value ?? null,
    set: (key, value) => {
      upsert.run({ key, value });
    },
    delete: (key) => {
      remove.run({ key });
    },
  };
}
