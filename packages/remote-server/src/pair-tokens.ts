import type { Database } from "bun:sqlite";
import { PAIR_TOKEN_ATTEMPTS, PAIR_TOKEN_TTL_MS } from "@kibo/remote/protocol";
import { randomToken, sha256 } from "./hashing";
import { createRateLimit } from "./rate-limit";

const PAIR_TOKEN_BYTES = 16;
export const PAIR_TOKEN_BLOCK_MS = 5 * 60_000;

export type Redemption = "ok" | "invalid" | "rate-limited";

export type PairTokens = {
  create(): { pairToken: string; expiresAt: number };
  redeem(pairToken: string): Redemption;
};

export function createPairTokens(db: Database, now: () => number): PairTokens {
  const limit = createRateLimit(
    db,
    "pair-token",
    { maxFailures: PAIR_TOKEN_ATTEMPTS, windowMs: PAIR_TOKEN_TTL_MS, blockMs: PAIR_TOKEN_BLOCK_MS },
    now,
  );
  return {
    create: () => {
      const pairToken = randomToken(PAIR_TOKEN_BYTES);
      const expiresAt = now() + PAIR_TOKEN_TTL_MS;
      db.run("INSERT INTO pair_tokens (token_hash, expires_at) VALUES (?, ?)", [
        sha256(pairToken),
        expiresAt,
      ]);
      return { pairToken, expiresAt };
    },
    redeem: (pairToken) => {
      if (limit.blocked()) return "rate-limited";
      db.run("DELETE FROM pair_tokens WHERE expires_at <= ?", [now()]);
      if (db.run("DELETE FROM pair_tokens WHERE token_hash = ?", [sha256(pairToken)]).changes > 0) {
        limit.succeed();
        return "ok";
      }
      return limit.fail() ? "rate-limited" : "invalid";
    },
  };
}
