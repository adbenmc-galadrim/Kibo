import { sha256Hex, toBase64, utf8 } from "./bytes";
import { signBytes } from "./ed25519";

export const HTTP_SIGNATURE_HEADERS = {
  device: "x-kibo-device",
  date: "x-kibo-date",
  nonce: "x-kibo-nonce",
  signature: "x-kibo-signature",
} as const;

export function httpSigningPayload(input: {
  method: string;
  path: string;
  date: string;
  nonce: string;
  bodySha256: string;
}): Uint8Array {
  return utf8(
    `kibo-http-v1\n${input.method}\n${input.path}\n${input.date}\n${input.nonce}\n${input.bodySha256}`,
  );
}

export async function signRequest(input: {
  deviceId: string;
  privateKey: string;
  method: string;
  path: string;
  body: Uint8Array;
  now: number;
}): Promise<Record<string, string>> {
  const date = String(input.now);
  const nonce = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const payload = httpSigningPayload({
    method: input.method,
    path: input.path,
    date,
    nonce,
    bodySha256: await sha256Hex(input.body),
  });
  return {
    [HTTP_SIGNATURE_HEADERS.device]: input.deviceId,
    [HTTP_SIGNATURE_HEADERS.date]: date,
    [HTTP_SIGNATURE_HEADERS.nonce]: nonce,
    [HTTP_SIGNATURE_HEADERS.signature]: await signBytes(input.privateKey, payload),
  };
}
