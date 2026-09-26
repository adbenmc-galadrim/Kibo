import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { fr } from "../i18n/fr";

const KNOWN: Partial<Record<KiboErrorCode, string>> = { ...fr.errors, ...fr.componentErrors };
const WITH_DETAIL = new Set<KiboErrorCode>(["GIT_FAILED", "GH_FAILED", "MIGRATION_FAILED"]);

export function errorMessage(e: unknown): string {
  if (!(e instanceof KiboError)) return fr.common.error;
  const text = KNOWN[e.code] ?? fr.common.error;
  const detail = e.detail.split("\n")[0]?.trim().slice(0, 200) ?? "";
  return WITH_DETAIL.has(e.code) && detail ? `${text} (${detail})` : text;
}
