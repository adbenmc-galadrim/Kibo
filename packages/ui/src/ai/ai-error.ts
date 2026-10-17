import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { frAi } from "../i18n/fr-ai";

const messages: Partial<Record<KiboErrorCode, string>> = frAi.ai.errors;

export function aiErrorMessage(e: unknown): string {
  const message = e instanceof KiboError ? messages[e.code] : undefined;
  if (message) return message;
  console.error(e);
  return fr.common.error;
}
