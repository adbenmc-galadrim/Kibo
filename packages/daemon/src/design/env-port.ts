import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ENV_FILE_MAX_BYTES, parseEnvPort } from "@kibo/schema";

const ENV_FILES = [".env.local", ".env"];

export function readBoundedFile(path: string): string | null {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.size > ENV_FILE_MAX_BYTES) return null;
  return readFileSync(path, "utf8");
}

export function readEnvPort(
  dir: string,
  name: string,
  read: (path: string) => string | null = readBoundedFile,
): number | null {
  for (const file of ENV_FILES) {
    const text = read(join(dir, file));
    const port = text === null ? null : parseEnvPort(text, name);
    if (port !== null) return port;
  }
  return null;
}
