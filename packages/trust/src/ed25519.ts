import { KiboError } from "@kibo/schema";
import { fromBase64, owned, sha256Hex, toBase64 } from "./bytes";
import { parsePublicKey } from "./public-key";

export { shortHash } from "@kibo/schema";
export { parsePublicKey } from "./public-key";

export type KeyPair = { publicKey: string; privateKey: string };

const ALG = { name: "Ed25519" } as const;
const MALFORMED_INPUT = new Set(["DataError", "InvalidAccessError"]);

function isMalformedInput(e: unknown): boolean {
  if (e instanceof KiboError || e instanceof TypeError) return true;
  return e instanceof Error && MALFORMED_INPUT.has(e.name);
}

export async function generateKeyPair(): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return { publicKey: toBase64(spki), privateKey: toBase64(pkcs8) };
}

async function importPrivateKey(privateKey: string): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey("pkcs8", owned(fromBase64(privateKey)), ALG, false, ["sign"]);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `invalid Ed25519 private key: ${String(e)}`);
  }
}

export async function signBytes(privateKey: string, data: Uint8Array): Promise<string> {
  const key = await importPrivateKey(privateKey);
  const sig = await crypto.subtle.sign(ALG, key, owned(data));
  return toBase64(new Uint8Array(sig));
}

export async function verifyBytes(publicKey: string, data: Uint8Array, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("spki", parsePublicKey(publicKey), ALG, false, ["verify"]);
    return await crypto.subtle.verify(ALG, key, owned(fromBase64(signature)), owned(data));
  } catch (e) {
    if (isMalformedInput(e)) return false;
    throw e;
  }
}

export async function keyFingerprint(publicKey: string): Promise<string> {
  return sha256Hex(parsePublicKey(publicKey));
}

export function formatFingerprint(hex: string): string {
  return (hex.match(/.{1,4}/g) ?? []).join(" ");
}
