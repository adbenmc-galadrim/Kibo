import { KiboError } from "@kibo/schema";
import { decodeBase64Url, encodeBase64Url } from "./base64url";
import type { RequestHeader, Sealed, SealedRequest, SnapshotHeader } from "./protocol";

export type RemoteKeys = { snapshot: CryptoKey; request: CryptoKey; epoch: number };

const ROOT_KEY_BYTES = 32;
const NONCE_BYTES = 12;
const SNAPSHOT_INFO = "kibo-remote/snapshot/v1";
const REQUEST_INFO = "kibo-remote/request/v1";
const utf8 = new TextEncoder();

const rejected = (detail: string) => new KiboError("REMOTE_REJECTED", detail);

export function generateRootKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(ROOT_KEY_BYTES));
}

async function directionKey(
  base: CryptoKey,
  accountId: string,
  info: string,
  epoch: number,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: utf8.encode(accountId), info: utf8.encode(`${info}:${epoch}`) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function deriveKeys(root: Uint8Array, accountId: string, epoch: number): Promise<RemoteKeys> {
  const base = await crypto.subtle.importKey("raw", new Uint8Array(root), "HKDF", false, ["deriveKey"]);
  const [snapshot, request] = await Promise.all([
    directionKey(base, accountId, SNAPSHOT_INFO, epoch),
    directionKey(base, accountId, REQUEST_INFO, epoch),
  ]);
  return { snapshot, request, epoch };
}

export const canonicalHeader = (header: SnapshotHeader | RequestHeader): Uint8Array<ArrayBuffer> =>
  utf8.encode(JSON.stringify(header, Object.keys(header).sort()));

type Envelope = { nonce: string; ciphertext: string };

async function seal(
  key: CryptoKey,
  header: SnapshotHeader | RequestHeader,
  epoch: number,
  plaintext: Uint8Array,
): Promise<Envelope> {
  if (header.keyEpoch !== epoch)
    throw rejected(`header epoch ${header.keyEpoch} differs from key epoch ${epoch}`);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: canonicalHeader(header) },
    key,
    new Uint8Array(plaintext),
  );
  return { nonce: encodeBase64Url(nonce), ciphertext: encodeBase64Url(new Uint8Array(ciphertext)) };
}

async function open(
  key: CryptoKey,
  header: SnapshotHeader | RequestHeader,
  epoch: number,
  envelope: Envelope,
): Promise<Uint8Array> {
  if (header.keyEpoch !== epoch)
    throw rejected(`block epoch ${header.keyEpoch} differs from key epoch ${epoch}`);
  const nonce = decodeBase64Url(envelope.nonce);
  const ciphertext = decodeBase64Url(envelope.ciphertext);
  if (nonce?.byteLength !== NONCE_BYTES || ciphertext === null) throw rejected("malformed sealed block");
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: canonicalHeader(header) },
      key,
      ciphertext,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw rejected("sealed block failed authentication");
  }
}

export async function sealSnapshot(
  keys: RemoteKeys,
  header: SnapshotHeader,
  plaintext: Uint8Array,
): Promise<Sealed> {
  return { header, ...(await seal(keys.snapshot, header, keys.epoch, plaintext)) };
}

export async function openSnapshot(keys: RemoteKeys, sealed: Sealed): Promise<Uint8Array> {
  return open(keys.snapshot, sealed.header, keys.epoch, sealed);
}

export async function sealRequest(
  keys: RemoteKeys,
  header: RequestHeader,
  plaintext: Uint8Array,
): Promise<SealedRequest> {
  return { header, ...(await seal(keys.request, header, keys.epoch, plaintext)) };
}

export async function openRequest(keys: RemoteKeys, sealed: SealedRequest): Promise<Uint8Array> {
  return open(keys.request, sealed.header, keys.epoch, sealed);
}
