import { githubStatusOf, KiboError, type KiboErrorCode } from "@kibo/schema";
import { fr } from "../i18n/fr";
import { errorMessage } from "./error-message";

export type SyncFailure = { code: KiboErrorCode; message: string };
export type SyncErrorContext = { repo: string; resumeAt: number | null };

const t = fr.integrations.githubErrors;
const UNAVAILABLE = new Set<KiboErrorCode>(["REMOTE_UNAVAILABLE", "TIMEOUT", "COMPONENT_CRASHED"]);

export const hourMinute = (ms: number) =>
  new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function failureOf(e: unknown): SyncFailure {
  if (e instanceof KiboError) return { code: e.code, message: e.detail };
  return { code: "INTERNAL", message: e instanceof Error ? e.message : String(e) };
}

function statusText(status: number, repo: string): string {
  if (status === 404 || status === 410) return t.notFound(status, repo);
  if (status === 401) return t.unauthorized;
  if (status === 403) return t.forbidden(repo);
  if (status === 422) return t.invalid;
  return t.status(status);
}

export function syncErrorText(failure: SyncFailure, ctx: SyncErrorContext): string {
  if (failure.code === "RATE_LIMITED")
    return ctx.resumeAt === null
      ? t.rateLimitedAuto
      : fr.integrations.state.rateLimited(hourMinute(ctx.resumeAt));
  if (UNAVAILABLE.has(failure.code)) return t.unavailable;
  if (failure.code === "NOT_CONNECTED") return t.notConnected;
  const status = githubStatusOf(failure.message);
  if (status !== null) return statusText(status, ctx.repo);
  if (failure.code === "REMOTE_NOT_FOUND") return t.notFound(404, ctx.repo);
  return errorMessage(new KiboError(failure.code, failure.message));
}
