import { beforeEach, expect, test } from "bun:test";
import { PAIRING_CODE_TTL_MS, PAIRING_MAX_FAILURES, PairingCodes } from "./pairing-codes";

let clock: number;
let codes: PairingCodes;
beforeEach(() => {
  clock = 1_000;
  codes = new PairingCodes(() => clock);
});

test("a code has 6 unambiguous characters and expires in 5 minutes", () => {
  const { code, expiresAt } = codes.create();
  expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  expect(expiresAt).toBe(1_000 + PAIRING_CODE_TTL_MS);
  expect(PAIRING_CODE_TTL_MS).toBe(5 * 60_000);
});

test("a code is single use", () => {
  const { code } = codes.create();
  expect(codes.redeem(code)).toBe("paired");
  expect(codes.redeem(code)).toBe("invalid");
});

test("spaces, dashes and lower case are accepted", () => {
  const { code } = codes.create();
  const typed = ` ${code.slice(0, 3).toLowerCase()} - ${code.slice(3)} `;
  expect(codes.redeem(typed)).toBe("paired");
});

test("an expired code is refused", () => {
  const { code } = codes.create();
  clock += PAIRING_CODE_TTL_MS;
  expect(codes.redeem(code)).toBe("invalid");
});

test("five wrong attempts invalidate every active code until a new one is created", () => {
  expect(PAIRING_MAX_FAILURES).toBe(5);
  const a = codes.create();
  const b = codes.create();
  for (let i = 0; i < 4; i++) expect(codes.redeem("ZZZZZZ")).toBe("invalid");
  expect(codes.redeem(a.code)).toBe("paired");
  expect(codes.redeem("ZZZZZZ")).toBe("rate-limited");
  expect(codes.redeem(b.code)).toBe("rate-limited");
  const c = codes.create();
  expect(codes.redeem(c.code)).toBe("paired");
});

test("attempts without any code created count towards the limit", () => {
  for (let i = 0; i < 4; i++) expect(codes.redeem("ABCDEF")).toBe("invalid");
  expect(codes.redeem("ABCDEF")).toBe("rate-limited");
});
