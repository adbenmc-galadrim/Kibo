import { setNonce } from "get-nonce";

export const readCspNonce = (doc: Document): string | null =>
  doc.querySelector('meta[property="csp-nonce"]')?.getAttribute("content") ?? null;

export function applyCspNonce(doc: Document, lend: (nonce: string) => void = setNonce): void {
  const nonce = readCspNonce(doc);
  if (nonce) lend(nonce);
}
