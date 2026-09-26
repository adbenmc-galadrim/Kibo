import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { fr } from "../i18n/fr";

const messages: Readonly<Record<string, string>> = fr.market.errors;

export function marketErrorCodeText(code: string): string {
  return Object.hasOwn(messages, code) ? (messages[code] ?? fr.common.error) : fr.common.error;
}

export function marketErrorCode(error: unknown): KiboErrorCode | null {
  return error instanceof KiboError ? error.code : null;
}

export function marketErrorText(error: unknown): string {
  if (!(error instanceof KiboError)) console.error(error);
  return error instanceof KiboError ? marketErrorCodeText(error.code) : fr.common.error;
}

export function storedErrorText(stored: string): string {
  return marketErrorCodeText(stored.split(":")[0] ?? "");
}
