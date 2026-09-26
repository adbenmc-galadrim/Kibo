import type { KiboErrorCode, RejectCode } from "@kibo/schema";

const ERROR_MESSAGES: Partial<Record<KiboErrorCode, string>> = {
  INVALID_INPUT: "invalid request",
  UNAUTHORIZED: "authentication failed",
  DEVICE_REVOKED: "device or user has been revoked",
  FORBIDDEN: "not allowed",
  NOT_FOUND: "not found",
  INVITE_INVALID: "invite code is invalid, expired or already used",
  RATE_LIMITED: "too many requests",
  TOO_LARGE: "request is too large",
  QUOTA_EXCEEDED: "quota exceeded",
  CONFLICT: "conflict",
  INTERNAL: "internal error",
};

const REJECT_MESSAGES: Record<RejectCode, string> = {
  UPDATE_REJECTED: "update rejected",
  OUT_OF_DATE: "update depends on changes the server does not have",
  FORBIDDEN: "not allowed to write this project",
  QUOTA_EXCEEDED: "project is over its size quota",
  RATE_LIMITED: "too many updates per second",
};

export function publicErrorMessage(code: KiboErrorCode): string {
  return ERROR_MESSAGES[code] ?? "request failed";
}

export function publicRejectMessage(code: RejectCode): string {
  return REJECT_MESSAGES[code];
}
