import type { FetchResponse } from "@kibo/schema";

const TEXT_TYPE = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|[^;]*\+(json|xml))/;
const DROPPED_RESPONSE_HEADERS = new Set(["set-cookie", "set-cookie2"]);

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

function decodeText({ bytes, truncated }: CappedBody): string {
  return new TextDecoder().decode(bytes, { stream: truncated });
}

export async function readProxiedBody(res: Response, maxBytes: number): Promise<FetchResponse> {
  const capped = await readCapped(res, maxBytes);
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
