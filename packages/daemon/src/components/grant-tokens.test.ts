import { expect, test } from "bun:test";
import { createGrantTokens } from "./grant-tokens";

const sequence = () => {
  let n = 0;
  return () => `${n++}`.padStart(64, "0");
};

test("a minted token reads its grant back until it expires", () => {
  const clock = { now: 0 };
  const tokens = createGrantTokens<{ id: string }>({ now: () => clock.now, ttlMs: 1000, perInstance: 2 });
  const a = tokens.mint("i", { id: "a" });
  expect(a.expiresAt).toBe(1000);
  expect(tokens.lookup(a.token)).toEqual({ id: "a" });
  clock.now = 999;
  expect(tokens.lookup(a.token)).toEqual({ id: "a" });
  clock.now = 1000;
  expect(tokens.lookup(a.token)).toBeNull();
});

test("the grant is copied when minted and when read", () => {
  const tokens = createGrantTokens<{ id: string }>({ now: () => 0, ttlMs: 1000 });
  const grant = { id: "a" };
  const { token } = tokens.mint("i", grant);
  grant.id = "changed";
  const read = tokens.lookup(token);
  if (read) read.id = "mutated";
  expect(tokens.lookup(token)).toEqual({ id: "a" });
});

test("an instance past its quota loses its oldest token", () => {
  const tokens = createGrantTokens<{ id: string }>({
    now: () => 0,
    ttlMs: 1000,
    perInstance: 2,
    random: sequence(),
  });
  const first = tokens.mint("i", { id: "1" });
  tokens.mint("i", { id: "2" });
  const third = tokens.mint("i", { id: "3" });
  expect(tokens.lookup(first.token)).toBeNull();
  expect(tokens.lookup(third.token)).toEqual({ id: "3" });
});

test("the 65th token of an instance drops the first by default", () => {
  const tokens = createGrantTokens<{ id: string }>({ now: () => 0, random: sequence() });
  const minted = Array.from({ length: 65 }, (_, i) => tokens.mint("i", { id: String(i) }).token);
  expect(tokens.lookup(minted[0] ?? "")).toBeNull();
  expect(tokens.lookup(minted[1] ?? "")).toEqual({ id: "1" });
  expect(tokens.lookup(minted[64] ?? "")).toEqual({ id: "64" });
});

test("two instances have separate quotas", () => {
  const tokens = createGrantTokens<{ id: string }>({
    now: () => 0,
    ttlMs: 1000,
    perInstance: 2,
    random: sequence(),
  });
  const a = tokens.mint("a", { id: "a" });
  tokens.mint("b", { id: "b1" });
  tokens.mint("b", { id: "b2" });
  tokens.mint("b", { id: "b3" });
  expect(tokens.lookup(a.token)).toEqual({ id: "a" });
});

test("an unknown token is null and default tokens are 32 random bytes in hex", () => {
  const tokens = createGrantTokens<{ id: string }>();
  expect(tokens.lookup("zz")).toBeNull();
  const a = tokens.mint("i", { id: "a" }).token;
  const b = tokens.mint("i", { id: "a" }).token;
  expect(a).toMatch(/^[0-9a-f]{64}$/);
  expect(a).not.toBe(b);
});
