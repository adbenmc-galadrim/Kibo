import { KiboError } from "@kibo/schema";

export type HttpGet = (url: string, opts: { timeoutMs: number; maxBytes: number }) => Promise<Uint8Array>;

type HttpGetOptions = { allowLoopbackHttp: boolean; ca?: string | null; fetchImpl?: typeof fetch };

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const MAX_REDIRECTS = 3;

export function createHttpGet(opts: HttpGetOptions): HttpGet {
  const doFetch = opts.fetchImpl ?? fetch;
  const allowed = (url: URL): void => {
    if (url.protocol === "https:") return;
    if (url.protocol === "http:" && opts.allowLoopbackHttp && LOOPBACK.has(url.hostname)) return;
    throw new KiboError("TLS_REQUIRED", `refusing ${url.protocol} download from ${url.host}`);
  };

  return async (raw, { timeoutMs, maxBytes }) => {
    let url = parseUrl(raw);
    allowed(url);
    const signal = AbortSignal.timeout(timeoutMs);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const res = await send(doFetch, url, signal, opts.ca ?? null);
      if (res.status >= 300 && res.status < 400) {
        await discard(res);
        url = redirected(res, url);
        allowed(url);
        continue;
      }
      if (!res.ok) {
        await discard(res);
        throw new KiboError(
          res.status === 404 ? "NOT_FOUND" : "INTERNAL",
          `GET ${url.href} returned ${res.status}`,
        );
      }
      return readLimited(res, maxBytes, url.href, signal);
    }
    throw new KiboError("INVALID_INPUT", `too many redirects from ${raw}`);
  };
}

function parseUrl(raw: string, base?: URL): URL {
  try {
    return new URL(raw, base);
  } catch {
    throw new KiboError("INVALID_INPUT", `invalid download url: ${raw}`);
  }
}

function redirected(res: Response, from: URL): URL {
  const location = res.headers.get("location");
  if (!location) throw new KiboError("INVALID_INPUT", `redirect without location from ${from.href}`);
  const next = parseUrl(location, from);
  if (next.host !== from.host) {
    throw new KiboError("INVALID_INPUT", `redirect to another host refused: ${next.host}`);
  }
  return next;
}

async function discard(res: Response): Promise<void> {
  await res.body?.cancel();
}

async function send(
  doFetch: typeof fetch,
  url: URL,
  signal: AbortSignal,
  ca: string | null,
): Promise<Response> {
  try {
    return await doFetch(url, { redirect: "manual", signal, ...(ca ? { tls: { ca } } : {}) });
  } catch (e) {
    if (signal.aborted) throw new KiboError("TIMEOUT", `download timed out: ${url.href}`);
    throw new KiboError("INTERNAL", `download failed: ${url.href}: ${String(e)}`);
  }
}

async function readLimited(
  res: Response,
  maxBytes: number,
  href: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const tooLarge = () => new KiboError("INVALID_INPUT", `${href} exceeds ${maxBytes} bytes`);
  if (Number(res.headers.get("content-length") ?? "0") > maxBytes) {
    await discard(res);
    throw tooLarge();
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const chunk = await readChunk(() => reader.read(), href, signal);
    if (chunk === null) break;
    total += chunk.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(chunk);
  }
  return concat(chunks, total);
}

async function readChunk(
  read: () => Promise<{ done: boolean; value?: unknown }>,
  href: string,
  signal: AbortSignal,
): Promise<Uint8Array | null> {
  let step: { done: boolean; value?: unknown };
  try {
    step = await read();
  } catch (e) {
    if (signal.aborted) throw new KiboError("TIMEOUT", `download timed out: ${href}`);
    throw new KiboError("INTERNAL", `download interrupted: ${href}: ${String(e)}`);
  }
  if (step.done) return null;
  if (!(step.value instanceof Uint8Array))
    throw new KiboError("INTERNAL", `unexpected body chunk from ${href}`);
  return step.value;
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
