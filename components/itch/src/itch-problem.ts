import { KiboError, type KiboErrorCode } from "@kibo/schema";

export type ItchProblemKind = "offline" | "refused" | "notFound" | "rateLimited" | "unavailable";
export type ItchProblem = { kind: ItchProblemKind; code: KiboErrorCode | null };

const BY_CODE: Partial<Record<KiboErrorCode, ItchProblemKind>> = {
  REMOTE_UNAVAILABLE: "offline",
  TIMEOUT: "offline",
  EMBED_REFUSED: "refused",
  REMOTE_NOT_FOUND: "notFound",
  RATE_LIMITED: "rateLimited",
};

export function itchProblemOf(e: unknown): ItchProblem {
  if (!(e instanceof KiboError)) return { kind: "unavailable", code: null };
  return { kind: BY_CODE[e.code] ?? "unavailable", code: e.code };
}
