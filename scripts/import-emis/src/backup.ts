import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { type BackupInfo, KiboError } from "@kibo/schema";
import type { SeedClient } from "./daemon-client";

export const REAL_HOME = join(homedir(), ".kibo");
export const isRealHome = (home: string): boolean => resolve(home) === REAL_HOME;

export function coldCopySteps(home: string, date: string): string[] {
  return [
    "Copie à froid avant l'import :",
    "  1. quitter Kibo (le démon s'arrête avec l'application) ;",
    `  2. cp -Rp ${home} ${home}-avant-emis-${date}`,
    "  3. relancer Kibo, puis l'import avec --yes.",
  ];
}

export async function preflight(
  client: SeedClient,
  options: { home: string; yes: boolean; date: string; print: (line: string) => void },
): Promise<BackupInfo> {
  if (isRealHome(options.home) && !options.yes) {
    for (const line of coldCopySteps(options.home, options.date)) options.print(line);
    throw new KiboError("FORBIDDEN", `refusing to write into ${options.home} without --yes`);
  }
  const backup = await client.rpc({ method: "createBackup", reason: "manual" });
  options.print(`backup ${backup.id} (${backup.bytes} bytes)`);
  return backup;
}
