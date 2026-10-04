import { readFileSync } from "node:fs";
import { join } from "node:path";

function readTauriVersion(): string {
  const conf: unknown = JSON.parse(
    readFileSync(join(import.meta.dirname, "../apps/desktop/src-tauri/tauri.conf.json"), "utf8"),
  );
  if (typeof conf !== "object" || conf === null || !("version" in conf) || typeof conf.version !== "string")
    throw new Error("tauri.conf.json has no version");
  return conf.version;
}

export const APP_VERSION = readTauriVersion();
