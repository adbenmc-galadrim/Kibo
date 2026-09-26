import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { fr } from "../i18n/fr";

const messages: Partial<Record<KiboErrorCode, string>> = fr.ai.errors;

export function aiErrorMessage(e: unknown): string {
  const message = e instanceof KiboError ? messages[e.code] : undefined;
  if (message) return message;
  console.error(e);
  return fr.common.error;
}
