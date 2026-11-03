import { KiboError } from "@kibo/schema";
import { decodeBase64Url, encodeBase64Url } from "./base64url";

export type PairingCode = { accountId: string; pairToken: string; rootKey: Uint8Array };

const PREFIX = "kibo1.";
const PAIR_TOKEN_BYTES = 16;
const ROOT_KEY_BYTES = 32;
const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/;

const invalid = (detail: string) => new KiboError("REMOTE_PAIRING_INVALID", detail);

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (char) => char.charCodeAt(0));

export function encodePairingCode(code: PairingCode): string {
  if (!ACCOUNT_ID.test(code.accountId)) throw invalid("account id must be 1 to 64 base64url characters");
  const token = decodeBase64Url(code.pairToken);
  if (token?.byteLength !== PAIR_TOKEN_BYTES) throw invalid(`pair token must hold ${PAIR_TOKEN_BYTES} bytes`);
  if (code.rootKey.byteLength !== ROOT_KEY_BYTES) throw invalid(`root key must hold ${ROOT_KEY_BYTES} bytes`);
  const account = ascii(code.accountId);
  const payload = new Uint8Array(1 + account.byteLength + PAIR_TOKEN_BYTES + ROOT_KEY_BYTES);
  payload[0] = account.byteLength;
  payload.set(account, 1);
  payload.set(token, 1 + account.byteLength);
  payload.set(code.rootKey, 1 + account.byteLength + PAIR_TOKEN_BYTES);
  return `${PREFIX}${encodeBase64Url(payload)}`;
}

export function decodePairingCode(text: string): PairingCode {
  const trimmed = text.trim();
  if (!trimmed.startsWith(PREFIX)) throw invalid("unknown pairing code prefix");
  const payload = decodeBase64Url(trimmed.slice(PREFIX.length));
  if (payload === null) throw invalid("pairing code is not base64url");
  const accountLength = payload[0] ?? 0;
  if (payload.byteLength !== 1 + accountLength + PAIR_TOKEN_BYTES + ROOT_KEY_BYTES) {
    throw invalid("pairing code has a wrong length");
  }
  const accountId = String.fromCharCode(...payload.subarray(1, 1 + accountLength));
  if (!ACCOUNT_ID.test(accountId)) throw invalid("pairing code has an invalid account id");
  const tokenStart = 1 + accountLength;
  return {
    accountId,
    pairToken: encodeBase64Url(payload.subarray(tokenStart, tokenStart + PAIR_TOKEN_BYTES)),
    rootKey: payload.slice(tokenStart + PAIR_TOKEN_BYTES),
  };
}
