export type KiboErrorCode =
  | "TREE_CYCLE"
  | "NOT_FOUND"
  | "BLOCKED_REASON_REQUIRED"
  | "INVALID_INPUT"
  | "LINK_CYCLE"
  | "STORE_CORRUPT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PERMISSION_DENIED";

export class KiboError extends Error {
  constructor(
    readonly code: KiboErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "KiboError";
  }
}
