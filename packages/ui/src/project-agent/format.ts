import { fr } from "../i18n/fr";

const ERRORS: Record<string, string> = fr.agents.errors;

export function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const DETAILED = new Set(["GIT_FAILED", "WORKSPACE_FAILED"]);

export function errorText(error: string | null): string {
  if (!error) return "";
  const [, code, detail] = /^([A-Z_]+):\s*([\s\S]*)$/.exec(error) ?? [];
  const label = code ? ERRORS[code] : undefined;
  if (!code || !label) return error;
  return DETAILED.has(code) && detail ? `${label} (${detail.trim()})` : label;
}
