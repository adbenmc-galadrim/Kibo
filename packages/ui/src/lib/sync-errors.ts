import { KiboError } from "@kibo/schema";

type Texts = Readonly<Record<string, string>> & { readonly fallback: string };

const SUSPENDED: ReadonlySet<string> = new Set(["TOO_LARGE", "INVALID_INPUT", "INTERNAL"]);

export function syncErrorText(texts: Texts, code: string): string {
  return Object.hasOwn(texts, code) ? (texts[code] ?? texts.fallback) : texts.fallback;
}

export function syncFailure(texts: Texts, e: unknown): string {
  return syncErrorText(texts, e instanceof KiboError ? e.code : "INTERNAL");
}

export const isSuspended = (code: string | null): boolean => code !== null && SUSPENDED.has(code);
