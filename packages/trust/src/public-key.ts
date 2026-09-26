import { KiboError } from "@kibo/schema";
import { fromBase64 } from "./bytes";

const SPKI_PREFIX = [0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00];
const SPKI_LENGTH = SPKI_PREFIX.length + 32;
const FIELD_PRIME = 2n ** 255n - 19n;
const ORDER_8_Y = 0x7a03ac9277fdc74ec6cc392cfa53202a0f67100d760b3cba4fd84d3d706a17c7n;
const SMALL_ORDER_Y = new Set([0n, 1n, FIELD_PRIME - 1n, ORDER_8_Y, FIELD_PRIME - ORDER_8_Y]);

function encodedY(point: Uint8Array): bigint {
  let y = 0n;
  for (let i = point.length - 1; i >= 0; i--) y = (y << 8n) | BigInt(point[i] ?? 0);
  return y & ((1n << 255n) - 1n);
}

function refuse(reason: string): never {
  throw new KiboError("INVALID_INPUT", `invalid Ed25519 public key: ${reason}`);
}

export function parsePublicKey(publicKey: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(fromBase64(publicKey));
  if (bytes.length !== SPKI_LENGTH) refuse("wrong length");
  if (SPKI_PREFIX.some((b, i) => bytes[i] !== b)) refuse("not an Ed25519 SPKI key");
  const y = encodedY(bytes.subarray(SPKI_PREFIX.length));
  if (y >= FIELD_PRIME) refuse("non-canonical point");
  if (SMALL_ORDER_Y.has(y)) refuse("small-order point");
  return bytes;
}
