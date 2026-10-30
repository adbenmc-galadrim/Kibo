import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isAppVersion, KiboError } from "@kibo/schema";

const TAURI_CONF = join(import.meta.dir, "../../../apps/desktop/src-tauri/tauri.conf.json");

type VersionEnv = { KIBO_VERSION?: string | undefined };

const JSON_VERSION = /"version":\s*"([^"]*)"/;

const notAppVersion = (version: string, where: string) =>
  new KiboError("INTERNAL", `${where} "${version}" is not a X.Y.Z or X.Y.Z-alpha.N version`);

function readAppVersion(tauriConf: string): string {
  const version = JSON_VERSION.exec(tauriConf)?.[1];
  if (version === undefined) throw new KiboError("INTERNAL", "tauri.conf.json has no version");
  if (!isAppVersion(version)) throw notAppVersion(version, "tauri.conf.json");
  return version;
}

const readTauriConf = (): string => readFileSync(TAURI_CONF, "utf8");
const buildEnv = (): VersionEnv => ({ KIBO_VERSION: process.env.KIBO_VERSION });

export function appVersion(env: VersionEnv = buildEnv(), readConf: () => string = readTauriConf): string {
  const injected = env.KIBO_VERSION;
  if (injected !== undefined) {
    if (!isAppVersion(injected)) throw notAppVersion(injected, "KIBO_VERSION");
    return injected;
  }
  return readAppVersion(readConf());
}
