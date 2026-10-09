import { KiboError } from "@kibo/schema";
import { frSecurity } from "../i18n/fr-security";

const { fallback, ...known } = frSecurity.errors;
const CODES: Readonly<Record<string, string>> = known;

export function securityErrorText(code: string): string {
  return Object.hasOwn(CODES, code) ? (CODES[code] ?? fallback) : fallback;
}

export function securityFailure(e: unknown): string {
  return securityErrorText(e instanceof KiboError ? e.code : "INTERNAL");
}
