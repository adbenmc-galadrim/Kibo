import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ENV_FILE_MAX_BYTES, findEnvPort } from "@kibo/schema";

const ENV_FILES = [".env.local", ".env"];

export function readBoundedFile(path: string): string | null {
  try {
    const stat = statSync(path, { throwIfNoEntry: false });
    if (!stat?.isFile() || stat.size > ENV_FILE_MAX_BYTES) return null;
    return readFileSync(path, "utf8");
  } catch (e) {
    console.warn(`[kibo-daemon] env file ${path} unreadable: ${String(e)}`);
    return null;
  }
}

export function readEnvPort(
  dir: string,
  name: string,
  read: (path: string) => string | null = readBoundedFile,
): number | null {
  for (const file of ENV_FILES) {
    const text = read(join(dir, file));
    const lookup = text === null ? null : findEnvPort(text, name);
    if (lookup?.found) return lookup.port;
  }
  return null;
}
