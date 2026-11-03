import type { Database } from "bun:sqlite";
import { PAIR_TOKEN_ATTEMPTS, PAIR_TOKEN_TTL_MS } from "@kibo/remote/protocol";
import { randomToken, sha256 } from "./hashing";

const PAIR_TOKEN_BYTES = 16;

export type Redemption = "ok" | "invalid" | "rate-limited";

export type PairTokens = {
  create(): { pairToken: string; expiresAt: number };
  redeem(pairToken: string): Redemption;
  clear(): void;
};

export function createPairTokens(db: Database, now: () => number): PairTokens {
  let failures = 0;
  const clear = () => {
    db.run("DELETE FROM pair_tokens");
  };
  return {
    create: () => {
      const pairToken = randomToken(PAIR_TOKEN_BYTES);
      const expiresAt = now() + PAIR_TOKEN_TTL_MS;
      db.run("INSERT INTO pair_tokens (token_hash, expires_at) VALUES (?, ?)", [
        sha256(pairToken),
        expiresAt,
      ]);
      failures = 0;
      return { pairToken, expiresAt };
    },
    redeem: (pairToken) => {
      if (failures >= PAIR_TOKEN_ATTEMPTS) return "rate-limited";
      db.run("DELETE FROM pair_tokens WHERE expires_at <= ?", [now()]);
      if (db.run("DELETE FROM pair_tokens WHERE token_hash = ?", [sha256(pairToken)]).changes > 0)
        return "ok";
      failures += 1;
      if (failures < PAIR_TOKEN_ATTEMPTS) return "invalid";
      clear();
      return "rate-limited";
    },
    clear,
  };
}
