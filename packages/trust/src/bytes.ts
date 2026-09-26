import { KiboError } from "@kibo/schema";

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export function fromBase64(text: string): Uint8Array {
  if (!BASE64.test(text) || text.length % 4 !== 0) {
    throw new KiboError("INVALID_INPUT", "invalid base64");
  }
  return new Uint8Array(Buffer.from(text, "base64"));
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? utf8(data) : data;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", owned(bytes)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
