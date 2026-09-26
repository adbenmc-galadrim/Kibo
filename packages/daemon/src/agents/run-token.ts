import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const HEX_HASH = /^[0-9a-f]{64}$/;

export function hashRunToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newRunToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, hash: hashRunToken(token) };
}

export function sameRunToken(token: string, hash: string): boolean {
  if (token.length === 0 || !HEX_HASH.test(hash)) return false;
  return timingSafeEqual(Buffer.from(hashRunToken(token), "hex"), Buffer.from(hash, "hex"));
}
