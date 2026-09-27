import { KiboError } from "@kibo/schema";

export type HttpGet = (url: string, opts: { timeoutMs: number; maxBytes: number }) => Promise<Uint8Array>;

type Log = (message: string, error: unknown) => void;
type HttpGetOptions = {
  allowLoopbackHttp: boolean;
  ca?: string | null;
  caFor?: (url: URL) => Promise<string | null>;
  fetchImpl?: typeof fetch;
  log?: Log;
};
type Chunk = { done: boolean; value?: unknown };

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const MAX_REDIRECTS = 3;
const defaultLog: Log = (message, error) => console.error(`[kibo-daemon] ${message}`, error);

export function createHttpGet(opts: HttpGetOptions): HttpGet {
  const doFetch = opts.fetchImpl ?? fetch;
  const log = opts.log ?? defaultLog;
  const allowed = (url: URL): void => {
    if (url.protocol === "https:") return;
    if (url.protocol === "http:" && opts.allowLoopbackHttp && LOOPBACK.has(url.hostname)) return;
    throw new KiboError("TLS_REQUIRED", "market downloads require https");
  };

  const download = async (raw: string, timeoutMs: number, maxBytes: number): Promise<Uint8Array> => {
    let url = parseUrl(raw);
    allowed(url);
    const signal = AbortSignal.timeout(timeoutMs);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const ca = opts.caFor ? await opts.caFor(url) : (opts.ca ?? null);
      const res = await send(doFetch, url, signal, ca);
      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel();
        url = redirected(res, url);
        allowed(url);
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        if (res.status === 404) throw new KiboError("NOT_FOUND", "market resource not found");
        throw new KiboError("INTERNAL", `market server answered ${res.status}`);
      }
      return readLimited(res, maxBytes, signal);
    }
    throw new KiboError("INVALID_INPUT", "too many redirects");
  };

  return async (raw, { timeoutMs, maxBytes }) => {
    try {
      return await download(raw, timeoutMs, maxBytes);
    } catch (e) {
      log(`market: GET ${raw} failed`, e);
      if (e instanceof KiboError) throw e;
      throw new KiboError("INTERNAL", "market download failed");
    }
  };
}

function parseUrl(raw: string, base?: URL): URL {
  try {
    return new URL(raw, base);
  } catch {
    throw new KiboError("INVALID_INPUT", "invalid market url");
  }
}

function redirected(res: Response, from: URL): URL {
  const location = res.headers.get("location");
  if (!location) throw new KiboError("INVALID_INPUT", "redirect without location");
  const next = parseUrl(location, from);
  if (next.host !== from.host) throw new KiboError("INVALID_INPUT", "redirect to another host refused");
  return next;
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
    if (signal.aborted) throw new KiboError("TIMEOUT", "market download timed out");
    throw e;
  }
}

async function readLimited(res: Response, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
  const tooLarge = () => new KiboError("INVALID_INPUT", `market resource exceeds ${maxBytes} bytes`);
  if (Number(res.headers.get("content-length") ?? "0") > maxBytes) {
    await res.body?.cancel();
    throw tooLarge();
  }
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const chunk = await readChunk(() => reader.read(), signal);
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

async function readChunk(read: () => Promise<Chunk>, signal: AbortSignal): Promise<Uint8Array | null> {
  let step: Chunk;
  try {
    step = await read();
  } catch (e) {
    if (signal.aborted) throw new KiboError("TIMEOUT", "market download timed out");
    throw e;
  }
  if (step.done) return null;
  if (!(step.value instanceof Uint8Array)) throw new KiboError("INTERNAL", "unexpected market body chunk");
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
