import { sha256Hex } from "./bytes";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PAIRING = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = ((value << 8) | byte) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function newInviteCode(): string {
  return base32(crypto.getRandomValues(new Uint8Array(16)));
}

export function newPairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => PAIRING[b & 31]).join("");
}

export function normalizeCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

export function formatPairingCode(code: string): string {
  const c = normalizeCode(code);
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

export function hashCode(code: string): Promise<string> {
  return sha256Hex(normalizeCode(code));
}
