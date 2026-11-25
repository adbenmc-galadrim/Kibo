import type { Sealed, SealedRequest } from "@kibo/remote/protocol";

const randomBase64Url = (length: number) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
};

export const sealedSnapshot = (projectId: string, kind: string, seq: number): Sealed => ({
  header: { v: 1, projectId, kind, seq, builtAt: 1_700_000_000_000, keyEpoch: 1 },
  nonce: randomBase64Url(12),
  ciphertext: randomBase64Url(48),
});

export const sealedRequest = (requestId: string = crypto.randomUUID()): SealedRequest => ({
  header: { v: 1, requestId, projectId: "p1", at: 1_700_000_000_000, keyEpoch: 1 },
  nonce: randomBase64Url(12),
  ciphertext: randomBase64Url(40),
});
