import { expect, test } from "bun:test";
import { base64ToBytes, bytesToBase64 } from "./base64";

test("bytes round-trip through base64, even past the argument limit of fromCharCode", () => {
  const big = Uint8Array.from({ length: 300_000 }, (_, i) => (i * 31) % 256);
  const encoded = bytesToBase64(big);
  expect(encoded).toBe(Buffer.from(big).toString("base64"));
  expect([...base64ToBytes(encoded)]).toEqual([...big]);
  expect(bytesToBase64(new Uint8Array())).toBe("");
  expect([...base64ToBytes("iVBORw==")]).toEqual([0x89, 0x50, 0x4e, 0x47]);
});
