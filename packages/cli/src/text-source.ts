import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KiboError } from "@kibo/schema";

const readStdin = (): string => readFileSync(0, "utf8");

export function readTextArg(raw: string, cwd: string, stdin: () => string = readStdin): string {
  if (raw === "@-") return stdin();
  if (!raw.startsWith("@")) return raw;
  const path = raw.slice(1);
  const file = resolve(cwd, path);
  if (!existsSync(file)) throw new KiboError("NOT_FOUND", `file not found: ${path}`);
  return readFileSync(file, "utf8");
}
