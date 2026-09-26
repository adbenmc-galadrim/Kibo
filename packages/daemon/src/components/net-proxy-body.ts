import type { FetchResponse } from "@kibo/schema";

const TEXT_TYPE = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|[^;]*\+(json|xml))/;
const DROPPED_RESPONSE_HEADERS = new Set(["set-cookie", "set-cookie2"]);

const MASK = new TextEncoder().encode("***");

export type CappedBody = { bytes: Uint8Array; truncated: boolean };

export async function readCapped(res: Response, maxBytes: number): Promise<CappedBody> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - total));
      await reader.cancel();
      return { bytes: Buffer.concat(chunks, maxBytes), truncated: true };
    }
    chunks.push(value);
    total += value.byteLength;
  }
  return { bytes: Buffer.concat(chunks, total), truncated: false };
}

export function scrubSecret(bytes: Uint8Array, secret: string): Uint8Array {
  const needle = Buffer.from(secret);
  if (needle.length === 0) return bytes;
  const source = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const parts: Uint8Array[] = [];
  let from = 0;
  for (let at = source.indexOf(needle, from); at >= 0; at = source.indexOf(needle, from)) {
    parts.push(source.subarray(from, at), MASK);
    from = at + needle.length;
  }
  if (from === 0) return bytes;
  parts.push(source.subarray(from));
  return Buffer.concat(parts);
}

function trailingPrefix(bytes: Uint8Array, needle: Uint8Array): number {
  for (let size = Math.min(needle.length - 1, bytes.length); size > 0; size -= 1) {
    const tail = bytes.subarray(bytes.length - size);
    if (Buffer.compare(tail, needle.subarray(0, size)) === 0) return size;
  }
  return 0;
}

export function scrubCapped(capped: CappedBody, secret: string | null): CappedBody {
  if (secret === null) return capped;
  const bytes = scrubSecret(capped.bytes, secret);
  if (!capped.truncated) return { bytes, truncated: false };
  const cut = trailingPrefix(bytes, Buffer.from(secret));
  if (cut === 0) return { bytes, truncated: true };
  return { bytes: Buffer.concat([bytes.subarray(0, bytes.length - cut), MASK]), truncated: true };
}

function decodeText({ bytes, truncated }: CappedBody): string {
  return new TextDecoder().decode(bytes, { stream: truncated });
}

export async function readProxiedBody(
  res: Response,
  maxBytes: number,
  secret: string | null = null,
): Promise<FetchResponse> {
  const capped = scrubCapped(await readCapped(res, maxBytes), secret);
  const headers: Record<string, string> = Object.fromEntries(
    [...res.headers].filter(([name]) => !DROPPED_RESPONSE_HEADERS.has(name) && !name.startsWith("x-kibo-")),
  );
  if (capped.truncated) headers["x-kibo-truncated"] = "1";
  const type = res.headers.get("content-type") ?? "";
  if (type === "" || TEXT_TYPE.test(type)) return { status: res.status, headers, body: decodeText(capped) };
  return {
    status: res.status,
    headers: { ...headers, "x-kibo-base64": "1" },
    body: Buffer.from(capped.bytes).toString("base64"),
  };
}
