import type { RunView } from "@kibo/schema";
import { fr } from "../i18n/fr";

const oneDecimal = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");
const ERRORS: Record<string, string> = fr.agents.errors;

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export function formatTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 10_000) return `${oneDecimal(n / 1_000)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1_000)}k`;
  return `${oneDecimal(n / 1_000_000)}M`;
}

export function formatGb(n: number): string {
  return oneDecimal(n);
}

export function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function elapsed(run: RunView, now: number): number {
  return run.activeMs + (run.turnStartedAt === null ? 0 : Math.max(0, now - run.turnStartedAt));
}

export function workspaceText(label: string | null): string {
  if (!label) return "";
  if (label.startsWith("worktree:")) return fr.agents.workspace.worktree(label.slice("worktree:".length));
  if (label === "repo") return fr.agents.workspace.repo;
  if (label === "isolated") return fr.agents.workspace.isolated;
  return label;
}

const DETAILED = new Set(["GIT_FAILED", "WORKSPACE_FAILED"]);

export function errorText(error: string | null): string {
  if (!error) return "";
  const [, code, detail] = /^([A-Z_]+):\s*([\s\S]*)$/.exec(error) ?? [];
  const label = code ? ERRORS[code] : undefined;
  if (!code || !label) return error;
  return DETAILED.has(code) && detail ? `${label} (${detail.trim()})` : label;
}
