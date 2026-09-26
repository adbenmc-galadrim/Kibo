import type { FetchResponse } from "@kibo/schema";

const TEXT_TYPE = /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|[^;]*\+(json|xml))/;
const DROPPED_RESPONSE_HEADERS = new Set(["set-cookie", "set-cookie2"]);

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body?.getReader();
  while (reader && total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks, total);
    const kept = value.subarray(0, maxBytes - total);
    chunks.push(kept);
    total += kept.byteLength;
  }
  await reader?.cancel();
  return Buffer.concat(chunks, total);
}

export async function readProxiedBody(res: Response, maxBytes: number): Promise<FetchResponse> {
  const bytes = await readCapped(res, maxBytes);
  const headers = Object.fromEntries(
    [...res.headers].filter(([name]) => !DROPPED_RESPONSE_HEADERS.has(name)),
  );
  const type = res.headers.get("content-type") ?? "";
  if (type === "" || TEXT_TYPE.test(type)) {
    return { status: res.status, headers, body: new TextDecoder().decode(bytes) };
  }
  return {
    status: res.status,
    headers: { ...headers, "x-kibo-base64": "1" },
    body: Buffer.from(bytes).toString("base64"),
  };
}
