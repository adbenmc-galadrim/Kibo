import { KiboError, type KiboErrorCode, type RpcResponse } from "@kibo/schema";

export const STATUS: Partial<Record<KiboErrorCode, number>> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PROFILE_IN_USE: 409,
  INVALID_TRANSITION: 409,
  GIT_PUSHED: 409,
  GIT_STALE: 409,
  GIT_BUSY: 409,
  FILE_CHANGED: 409,
  PATH_OUTSIDE_PROJECT: 403,
  TOO_LARGE: 413,
  GH_UNAVAILABLE: 502,
  GH_FAILED: 502,
  TRUST_REQUIRED: 403,
  PERMISSION_DENIED: 403,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  COMPONENT_CRASHED: 502,
  HASH_MISMATCH: 409,
  VERSION_EXISTS: 409,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  MIGRATION_FAILED: 422,
  QUOTA_EXCEEDED: 413,
  SANDBOX_UNAVAILABLE: 503,
  SECRET_STORE_UNAVAILABLE: 503,
  NOT_CONNECTED: 409,
  REMOTE_UNAVAILABLE: 502,
  REMOTE_REJECTED: 502,
  REMOTE_NOT_FOUND: 404,
  REMOTE_CONFLICT: 409,
  MCP_UNAVAILABLE: 502,
  MCP_FAILED: 502,
  AI_UNAVAILABLE: 503,
  UPDATE_REJECTED: 409,
  ACCESS_REVOKED: 403,
  INVITE_INVALID: 400,
  DEVICE_REVOKED: 401,
  TLS_REQUIRED: 400,
  SYNC_OFFLINE: 503,
  SIGNATURE_INVALID: 422,
  PUBLISHER_CHANGED: 409,
  REVOKED: 410,
  INDEX_ROLLBACK: 409,
  DAEMON_RUNNING: 409,
  PROJECT_FOLDER_MISSING: 409,
  PROJECT_FOLDER_NOT_FOUND: 404,
};
const HIDDEN = new Set<KiboErrorCode>(["INTERNAL", "STORE_CORRUPT"]);

const json = (body: RpcResponse, status = 200) => Response.json(body, { status });
export const fail = (code: KiboErrorCode, message: string, status: number) =>
  json({ ok: false, error: { code, message } }, status);
const internal = (e: unknown) => {
  console.error("[kibo-daemon] request failed", e);
  return fail("INTERNAL", "internal error", 500);
};
export const unredacted = (text: string) => text;
export const respond = async (work: () => unknown, redact: (text: string) => string): Promise<Response> => {
  try {
    return json({ ok: true, result: (await work()) ?? null });
  } catch (e) {
    if (!(e instanceof KiboError) || HIDDEN.has(e.code)) return internal(e);
    return fail(e.code, redact(e.detail), STATUS[e.code] ?? 400);
  }
};
