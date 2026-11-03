import { describe, expect, test } from "bun:test";
import { createChallenges } from "./challenges";
import { openDb } from "./db";

describe("challenges", () => {
  test("a flood of login challenges never evicts a pairing challenge", () => {
    const challenges = createChallenges(openDb(":memory:"), () => 1_000);
    challenges.issue("pair-1", "pair");
    for (let i = 0; i < 100; i++) challenges.issue(`login-${i}`, "login");
    expect(challenges.consume("pair-1", "pair")).toBe(true);
    expect(challenges.consume("login-99", "login")).toBe(true);
    expect(challenges.consume("login-0", "login")).toBe(false);
  });
});
