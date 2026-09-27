import { KiboError } from "@kibo/schema";
import { fr } from "../i18n/fr";

const { fallback, ...known } = fr.security.errors;
const CODES: Readonly<Record<string, string>> = known;

export function securityErrorText(code: string): string {
  return Object.hasOwn(CODES, code) ? (CODES[code] ?? fallback) : fallback;
}

export function securityFailure(e: unknown): string {
  return securityErrorText(e instanceof KiboError ? e.code : "INTERNAL");
}
