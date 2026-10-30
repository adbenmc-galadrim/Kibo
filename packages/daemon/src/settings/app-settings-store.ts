import type { Database } from "bun:sqlite";
import { AppSettings, type AppSettingsPatch, KiboError } from "@kibo/schema";

export type AppSettingsStore = { get(): AppSettings; set(patch: AppSettingsPatch): AppSettings };

type Row = { key: string; json: string };

function parseJson(row: Row): unknown {
  try {
    return JSON.parse(row.json);
  } catch (e) {
    throw new KiboError(
      "STORE_CORRUPT",
      `app setting ${row.key}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function createAppSettingsStore(db: Database, now: () => number): AppSettingsStore {
  db.exec(
    "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  );
  const select = db.query<Row, []>("SELECT key, json FROM app_settings");
  const upsert = db.query<never, { key: string; json: string; at: number }>(
    "INSERT INTO app_settings (key, json, updated_at) VALUES ($key, $json, $at) " +
      "ON CONFLICT(key) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
  );
  const get = (): AppSettings => {
    const rows = select.all();
    const stored = Object.fromEntries(rows.map((row) => [row.key, parseJson(row)]));
    const parsed = AppSettings.safeParse(stored);
    if (!parsed.success) throw new KiboError("STORE_CORRUPT", `app settings: ${parsed.error.message}`);
    return parsed.data;
  };
  return {
    get,
    set(patch) {
      const at = now();
      db.transaction(() => {
        for (const [key, value] of Object.entries(patch))
          if (value !== undefined) upsert.run({ key, json: JSON.stringify(value), at });
      })();
      return get();
    },
  };
}
