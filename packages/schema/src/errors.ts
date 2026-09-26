export const KIBO_ERROR_CODES = [
  "TREE_CYCLE",
  "NOT_FOUND",
  "BLOCKED_REASON_REQUIRED",
  "INVALID_INPUT",
  "LINK_CYCLE",
  "STORE_CORRUPT",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "PERMISSION_DENIED",
  "INVALID_TRANSITION",
  "PROFILE_IN_USE",
  "WORKSPACE_FAILED",
  "AGENT_CLI_NOT_FOUND",
  "INTERNAL",
  "NOT_A_REPO",
  "PATH_OUTSIDE_PROJECT",
  "GIT_FAILED",
  "GIT_STALE",
  "GIT_PUSHED",
  "GIT_BUSY",
  "FILE_CHANGED",
  "GH_UNAVAILABLE",
  "GH_FAILED",
  "EDITOR_UNAVAILABLE",
  "TOO_LARGE",
  "HASH_MISMATCH",
  "TRUST_REQUIRED",
  "VERSION_EXISTS",
  "VALIDATION_FAILED",
  "MIGRATION_FAILED",
  "COMPONENT_CRASHED",
  "TIMEOUT",
  "CONFLICT",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "SANDBOX_UNAVAILABLE",
  "SECRET_STORE_UNAVAILABLE",
  "NOT_CONNECTED",
  "REMOTE_UNAVAILABLE",
  "REMOTE_REJECTED",
  "REMOTE_NOT_FOUND",
  "REMOTE_CONFLICT",
  "MCP_UNAVAILABLE",
  "MCP_FAILED",
  "AI_UNAVAILABLE",
  "UPDATE_REJECTED",
  "ACCESS_REVOKED",
  "INVITE_INVALID",
  "DEVICE_REVOKED",
  "TLS_REQUIRED",
  "SYNC_OFFLINE",
  "SIGNATURE_INVALID",
  "PUBLISHER_CHANGED",
  "REVOKED",
  "INDEX_ROLLBACK",
] as const;

export type KiboErrorCode = (typeof KIBO_ERROR_CODES)[number];

export const isKiboErrorCode = (v: unknown): v is KiboErrorCode =>
  typeof v === "string" && (KIBO_ERROR_CODES as readonly string[]).includes(v);

export class KiboError extends Error {
  constructor(
    readonly code: KiboErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "KiboError";
  }
}
