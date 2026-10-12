import type { Database } from "bun:sqlite";
import {
  type AgentRef,
  AgentSettings,
  type AgentSettingsPatch,
  KiboError,
  parseAgentRef,
  systemAgentSettings,
} from "@kibo/schema";

export type AgentSettingsStore = {
  get(ref: AgentRef): AgentSettings;
  getStored(ref: AgentRef): Partial<AgentSettings> | null;
  set(ref: AgentRef, patch: AgentSettingsPatch): AgentSettings;
  move(from: AgentRef, to: AgentRef): void;
  remove(ref: AgentRef): void;
  citing(ref: AgentRef): AgentRef[];
};

type Row = { ref: string; json: string };

const StoredSettings = AgentSettings.partial();

function parseStored(row: Row): Partial<AgentSettings> | null {
  try {
    const parsed = StoredSettings.safeParse(JSON.parse(row.json));
    if (parsed.success) return parsed.data;
    console.error(`[kibo-daemon] agent settings ${row.ref} ignored: ${parsed.error.message}`);
  } catch (e) {
    console.error(`[kibo-daemon] agent settings ${row.ref} ignored: ${String(e)}`);
  }
  return null;
}

export function settingsOf(ref: AgentRef, stored: Partial<AgentSettings>): AgentSettings {
  const parsed = parseAgentRef(ref);
  if (parsed.scope === "system") return systemAgentSettings(parsed.id, stored);
  return AgentSettings.parse(stored);
}

export function createAgentSettingsStore(db: Database, now: () => number = Date.now): AgentSettingsStore {
  db.exec(
    "CREATE TABLE IF NOT EXISTS agent_settings (ref TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at INTEGER NOT NULL)",
  );
  const select = db.query("SELECT ref, json FROM agent_settings WHERE ref = $ref");
  const all = db.query("SELECT ref, json FROM agent_settings ORDER BY ref");
  const upsert = db.query(
    "INSERT INTO agent_settings (ref, json, updated_at) VALUES ($ref, $json, $at) " +
      "ON CONFLICT(ref) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
  );
  const remove = db.query("DELETE FROM agent_settings WHERE ref = $ref");
  const rename = db.query("UPDATE agent_settings SET ref = $to, updated_at = $at WHERE ref = $from");

  const getStored = (ref: AgentRef) => {
    const row = select.get({ ref }) as Row | null;
    return row ? parseStored(row) : null;
  };
  const get = (ref: AgentRef) => settingsOf(ref, getStored(ref) ?? {});

  return {
    get,
    getStored,
    set(ref, patch) {
      const merged = StoredSettings.safeParse({ ...getStored(ref), ...patch });
      if (!merged.success) throw new KiboError("INVALID_INPUT", merged.error.message);
      upsert.run({ ref, json: JSON.stringify(merged.data), at: now() });
      return get(ref);
    },
    move(from, to) {
      remove.run({ ref: to });
      rename.run({ from, to, at: now() });
    },
    remove(ref) {
      remove.run({ ref });
    },
    citing(ref) {
      return (all.all() as Row[])
        .filter((row) => parseStored(row)?.subagents?.includes(ref))
        .map((row) => row.ref);
    },
  };
}
