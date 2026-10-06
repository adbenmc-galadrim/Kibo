import type { DesignProvider } from "./design";
import { KiboError, type KiboErrorCode } from "./errors";

export const FRAME_PROBLEM_KINDS = [
  "notConnected",
  "tokenRefused",
  "otherInstance",
  "notFound",
  "noThumbnail",
  "unreachable",
  "rateLimited",
  "mcpClosed",
  "unavailable",
] as const;
export type FrameProblemKind = (typeof FRAME_PROBLEM_KINDS)[number];
export type FrameProblem = { kind: FrameProblemKind; code: KiboErrorCode | null };
export type FrameProblemContext = { provider: DesignProvider; name: string; host: string; code: string };

const BY_CODE: Partial<Record<KiboErrorCode, FrameProblemKind>> = {
  NOT_CONNECTED: "notConnected",
  REMOTE_REJECTED: "tokenRefused",
  TOKEN_IGNORED: "tokenRefused",
  REMOTE_NOT_FOUND: "notFound",
  REMOTE_NOT_RENDERED: "noThumbnail",
  REMOTE_UNAVAILABLE: "unreachable",
  TIMEOUT: "unreachable",
  RATE_LIMITED: "rateLimited",
  MCP_UNAVAILABLE: "mcpClosed",
};
const INSTANCE_CODES: ReadonlySet<KiboErrorCode> = new Set(["INVALID_INPUT", "PERMISSION_DENIED"]);

export function frameProblemOf(e: unknown, provider: DesignProvider): FrameProblem {
  if (!(e instanceof KiboError)) return { kind: "unavailable", code: null };
  if (provider === "penpot" && INSTANCE_CODES.has(e.code)) return { kind: "otherInstance", code: e.code };
  return { kind: BY_CODE[e.code] ?? "unavailable", code: e.code };
}
