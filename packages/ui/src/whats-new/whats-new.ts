import { readPref, writePref } from "../lib/local-pref";

export const WHATS_NEW_KEY = "kibo.whatsNew.seenVersion";

export function whatsNewDecision(seen: string | null, installed: string): "store" | "show" | "none" {
  if (seen === null) return "store";
  return seen === installed ? "none" : "show";
}

export const markWhatsNewSeen = (version: string): void => writePref(WHATS_NEW_KEY, version);

export function applyWhatsNew(installed: string, open: () => void): void {
  const seen = readPref(WHATS_NEW_KEY, "");
  const decision = whatsNewDecision(seen === "" ? null : seen, installed);
  if (decision === "store") markWhatsNewSeen(installed);
  if (decision === "show") open();
}
