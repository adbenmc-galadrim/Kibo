import { expect, test } from "bun:test";
import { constantTimeEqual, fromBase64, sha256Hex, toBase64, utf8 } from "./bytes";

test("base64 round-trips arbitrary bytes", () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
  expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  expect(toBase64(utf8("kibo"))).toBe("a2libw==");
});

test("invalid base64 is refused", () => {
  expect(() => fromBase64("a2l*bw==")).toThrow("INVALID_INPUT");
  expect(() => fromBase64("abc")).toThrow("INVALID_INPUT");
});

test("sha256Hex hashes strings and bytes identically", async () => {
  expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(await sha256Hex(utf8("abc"))).toBe(await sha256Hex("abc"));
});

test("constantTimeEqual compares content and length", () => {
  expect(constantTimeEqual(utf8("ab"), utf8("ab"))).toBe(true);
  expect(constantTimeEqual(utf8("ab"), utf8("ac"))).toBe(false);
  expect(constantTimeEqual(utf8("ab"), utf8("abc"))).toBe(false);
});
