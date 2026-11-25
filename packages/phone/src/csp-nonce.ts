import { styleNonce } from "@kibo/sdk/lib/style-nonce";
import { setNonce } from "get-nonce";

export const readCspNonce = (doc: Document): string | null => styleNonce(doc) ?? null;

export function applyCspNonce(doc: Document, lend: (nonce: string) => void = setNonce): void {
  const nonce = readCspNonce(doc);
  if (nonce) lend(nonce);
}
