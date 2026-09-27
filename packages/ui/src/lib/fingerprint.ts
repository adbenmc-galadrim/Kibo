import { fr } from "../i18n/fr";

export function groupFingerprint(hex: string): string {
  return (hex.match(/.{1,4}/g) ?? []).join(" ");
}

export function fingerprintHead(hex: string): string {
  return `${groupFingerprint(hex.slice(0, 8))} …`;
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function base64Bytes(text: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64.test(text) || text.length % 4 === 1) return null;
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function keyFingerprintHex(publicKey: string): Promise<string | null> {
  const raw = base64Bytes(publicKey);
  if (!raw) return null;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function shortKeyPrint(hex: string): string {
  return fr.market.keyPrint(hex.slice(0, 4), hex.slice(-4));
}
