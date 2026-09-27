import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const SYNC_PORTS = {
  server: 4406,
  dark: { a: 4407, b: 4408 },
  light: { a: 4409, b: 4410 },
  control: 4411,
} as const;
export const SYNC_STATE_FILE = join(tmpdir(), "kibo-e2e-sync-state.json");
export type SyncE2eState = {
  caFile: string;
  serverUrl: string;
  codes: Record<"darkA" | "darkB" | "lightA" | "lightB", string>;
};

export function readSyncState(): SyncE2eState {
  return JSON.parse(readFileSync(SYNC_STATE_FILE, "utf8")) as SyncE2eState;
}
