import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readAppVersion } from "@kibo/devkit";
import { isAppVersion, KiboError } from "@kibo/schema";

const TAURI_CONF = join(import.meta.dir, "../../../apps/desktop/src-tauri/tauri.conf.json");

type VersionEnv = { KIBO_VERSION?: string | undefined };

const readTauriConf = (): string => readFileSync(TAURI_CONF, "utf8");
const buildEnv = (): VersionEnv => ({ KIBO_VERSION: process.env.KIBO_VERSION });

export function appVersion(env: VersionEnv = buildEnv(), readConf: () => string = readTauriConf): string {
  const injected = env.KIBO_VERSION;
  if (injected !== undefined) {
    if (!isAppVersion(injected))
      throw new KiboError("INTERNAL", `KIBO_VERSION "${injected}" is not a X.Y.Z or X.Y.Z-alpha.N version`);
    return injected;
  }
  return readAppVersion(readConf());
}
