import { expect, test } from "bun:test";
import { hashRunToken, newRunToken, sameRunToken } from "./run-token";

test("run tokens are 32 random bytes and only their hash is kept", () => {
  const a = newRunToken();
  const b = newRunToken();
  expect(a.token).toMatch(/^[0-9a-f]{64}$/);
  expect(a.token).not.toBe(b.token);
  expect(a.hash).toBe(hashRunToken(a.token));
  expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  expect(a.hash).not.toContain(a.token);
});

test("a token matches only its own hash", () => {
  const a = newRunToken();
  const b = newRunToken();
  expect(sameRunToken(a.token, a.hash)).toBe(true);
  expect(sameRunToken(b.token, a.hash)).toBe(false);
  expect(sameRunToken(a.hash, a.hash)).toBe(false);
  expect(sameRunToken("", a.hash)).toBe(false);
  expect(sameRunToken(a.token, "")).toBe(false);
  expect(sameRunToken(a.token, a.hash.slice(0, 32))).toBe(false);
  expect(sameRunToken(a.token, "zz")).toBe(false);
});
