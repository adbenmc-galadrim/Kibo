import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_TERMS_PATH = join(homedir(), ".config", "kibo", "termes-interdits.txt");

export function parseTerms(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().normalize("NFC"))
    .filter((line) => line.length > 0);
}

export function loadTerms(path: string): string[] | null {
  if (!existsSync(path)) return null;
  return parseTerms(readFileSync(path, "utf8"));
}
