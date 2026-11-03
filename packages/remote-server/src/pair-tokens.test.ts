import { describe, expect, test } from "bun:test";
import { PAIR_TOKEN_ATTEMPTS, PAIR_TOKEN_TTL_MS } from "@kibo/remote/protocol";
import { openDb } from "./db";
import { createPairTokens, PAIR_TOKEN_BLOCK_MS } from "./pair-tokens";

const setup = () => {
  let now = 1_000;
  const tokens = createPairTokens(openDb(":memory:"), () => now);
  return {
    tokens,
    advance: (ms: number) => {
      now += ms;
    },
  };
};

describe("pair tokens", () => {
  test("a token redeems once", () => {
    const { tokens } = setup();
    const { pairToken, expiresAt } = tokens.create();
    expect(expiresAt).toBe(1_000 + PAIR_TOKEN_TTL_MS);
    expect(tokens.redeem(pairToken)).toBe("ok");
    expect(tokens.redeem(pairToken)).toBe("invalid");
  });

  test("an expired token is invalid", () => {
    const { tokens, advance } = setup();
    const { pairToken } = tokens.create();
    advance(PAIR_TOKEN_TTL_MS);
    expect(tokens.redeem(pairToken)).toBe("invalid");
  });

  test("too many wrong tokens rate-limit for a while, then the right token still works", () => {
    const { tokens, advance } = setup();
    const { pairToken } = tokens.create();
    for (let i = 1; i < PAIR_TOKEN_ATTEMPTS; i++) expect(tokens.redeem("wrong")).toBe("invalid");
    expect(tokens.redeem("wrong")).toBe("rate-limited");
    expect(tokens.redeem(pairToken)).toBe("rate-limited");
    expect(tokens.create().pairToken).not.toBe(pairToken);
    expect(tokens.redeem(pairToken)).toBe("rate-limited");
    advance(PAIR_TOKEN_BLOCK_MS);
    expect(tokens.redeem(pairToken)).toBe("ok");
  });

  test("anonymous failures do not destroy a legitimate token", () => {
    const db = openDb(":memory:");
    const now = 1_000;
    const { pairToken } = createPairTokens(db, () => now).create();
    const tokens = createPairTokens(db, () => now);
    for (let i = 0; i < PAIR_TOKEN_ATTEMPTS; i++) tokens.redeem("wrong");
    expect(db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM pair_tokens").get()?.n).toBe(1);
    expect(createPairTokens(db, () => now + PAIR_TOKEN_BLOCK_MS).redeem(pairToken)).toBe("ok");
  });

  test("the failure count survives a restart", () => {
    const db = openDb(":memory:");
    const first = createPairTokens(db, () => 0);
    const { pairToken } = first.create();
    for (let i = 0; i < PAIR_TOKEN_ATTEMPTS; i++) first.redeem("wrong");
    expect(createPairTokens(db, () => 1).redeem(pairToken)).toBe("rate-limited");
  });

  test("only a hash of the token is stored", () => {
    const db = openDb(":memory:");
    const { pairToken } = createPairTokens(db, () => 0).create();
    const stored = db.query<{ token_hash: Uint8Array }, []>("SELECT token_hash FROM pair_tokens").get();
    expect(Buffer.from(stored?.token_hash ?? []).toString("base64url")).not.toBe(pairToken);
    expect(stored?.token_hash.length).toBe(32);
  });
});
