import { createHash, timingSafeEqual } from "node:crypto";

export const sha256 = (text: string): Uint8Array =>
  new Uint8Array(createHash("sha256").update(text).digest());

export const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && timingSafeEqual(a, b);

export const sameSecret = (given: string, expected: string): boolean =>
  sameBytes(sha256(given), sha256(expected));

export function randomToken(bytes: number): string {
  const out = new Uint8Array(bytes);
  crypto.getRandomValues(out);
  return Buffer.from(out).toString("base64url");
}
