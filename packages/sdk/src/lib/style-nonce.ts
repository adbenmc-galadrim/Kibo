const CSP_NONCE_META = 'meta[property="csp-nonce"]';

export function styleNonce(doc: Document | undefined = globalThis.document): string | undefined {
  return doc?.querySelector(CSP_NONCE_META)?.getAttribute("content") || undefined;
}
