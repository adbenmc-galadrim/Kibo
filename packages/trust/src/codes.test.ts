import { expect, test } from "bun:test";
import { formatPairingCode, hashCode, newInviteCode, newPairingCode, normalizeCode } from "./codes";

test("invite codes carry 128 bits in 26 base32 characters", () => {
  const a = newInviteCode();
  const b = newInviteCode();
  expect(a).toMatch(/^[A-Z2-7]{26}$/);
  expect(a).not.toBe(b);
  expect(a.at(-1)).toMatch(/^[A-Z2-7]$/);
});

test("pairing codes avoid ambiguous characters", () => {
  for (let i = 0; i < 200; i++) {
    const code = newPairingCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  }
});

test("codes are normalized before comparison", () => {
  expect(normalizeCode(" k7q-4m2 ")).toBe("K7Q4M2");
  expect(normalizeCode("abcd efgh\tijkl-mnop")).toBe("ABCDEFGHIJKLMNOP");
  expect(formatPairingCode("K7Q4M2")).toBe("K7Q-4M2");
});

test("hashCode is identical for every spelling of the same code", async () => {
  const code = newInviteCode();
  const spaced = code.toLowerCase().replace(/(.{4})/g, "$1 ");
  const dashed = code.replace(/(.{4})/g, "$1-");
  expect(await hashCode(spaced)).toBe(await hashCode(code));
  expect(await hashCode(dashed)).toBe(await hashCode(code));
  expect(await hashCode(code)).toMatch(/^[0-9a-f]{64}$/);
  expect(await hashCode(newInviteCode())).not.toBe(await hashCode(code));
});
