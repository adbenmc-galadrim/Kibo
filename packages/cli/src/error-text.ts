import type { KiboError } from "@kibo/schema";
import { FR_ERRORS } from "./fr-errors";

export function explainError(e: KiboError): string | null {
  for (const entry of FR_ERRORS) {
    if (entry.code !== undefined && entry.code !== e.code) continue;
    const found = entry.match.exec(e.detail);
    if (found) return entry.text(found);
  }
  return null;
}
