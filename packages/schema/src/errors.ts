export type KiboErrorCode =
  | "TREE_CYCLE"
  | "NOT_FOUND"
  | "BLOCKED_REASON_REQUIRED"
  | "INVALID_INPUT"
  | "LINK_CYCLE"
  | "STORE_CORRUPT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PERMISSION_DENIED"
  | "INVALID_TRANSITION"
  | "PROFILE_IN_USE"
  | "WORKSPACE_FAILED"
  | "AGENT_CLI_NOT_FOUND"
  | "INTERNAL";

export class KiboError extends Error {
  constructor(
    readonly code: KiboErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "KiboError";
  }
}
