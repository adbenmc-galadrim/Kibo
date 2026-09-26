import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { type FetchInit, type FetchResponse, KiboError, ruleCovers } from "@kibo/schema";
import { isPublicAddress } from "./net-proxy-address";
import { readProxiedBody } from "./net-proxy-body";

export { isPublicAddress } from "./net-proxy-address";

export type Resolver = (host: string) => Promise<string[]>;
export type NetProxyOptions = {
  resolve?: Resolver;
  transport?: typeof fetch;
  allowAddress?: (ip: string) => boolean;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const STRIPPED_HEADERS = new Set([
  "cookie",
  "authorization",
  "host",
  "connection",
  "keep-alive",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "expect",
]);
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const HEADER_VALUE = /^[^\r\n\0]*$/;

export const systemResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

function outgoingHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!HEADER_NAME.test(name) || !HEADER_VALUE.test(value)) {
      throw new KiboError("INVALID_INPUT", "invalid request header");
    }
    const lower = name.toLowerCase();
    if (!STRIPPED_HEADERS.has(lower) && !lower.startsWith("proxy-")) out[lower] = value;
  }
  return out;
}

function checkedUrl(rules: readonly string[] | null, url: string): URL {
  if (!URL.canParse(url)) throw new KiboError("INVALID_INPUT", "invalid url");
  const u = new URL(url);
  if (u.protocol !== "https:") throw new KiboError("PERMISSION_DENIED", "only https is allowed");
  if (u.username !== "" || u.password !== "") {
    throw new KiboError("PERMISSION_DENIED", "credentials in url are not allowed");
  }
  if (rules !== null && !rules.some((rule) => ruleCovers(rule, u.href))) {
    throw new KiboError("PERMISSION_DENIED", `no net rule covers a url on ${u.hostname}`);
  }
  return u;
}

const bareHost = (u: URL) => (u.hostname.startsWith("[") ? u.hostname.slice(1, -1) : u.hostname);

function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function checkedAddress(
  u: URL,
  resolve: Resolver,
  allow: (ip: string) => boolean,
  signal: AbortSignal,
): Promise<string> {
  const host = bareHost(u);
  const addresses = isIP(host) ? [host] : await untilAborted(resolve(host), signal);
  const [first] = addresses;
  if (first === undefined || !addresses.every(allow)) {
    throw new KiboError("PERMISSION_DENIED", `address not allowed for ${host}`);
  }
  return first;
}

function pinnedRequest(u: URL, address: string) {
  const pinned = new URL(u.href);
  pinned.hostname = isIP(address) === 6 ? `[${address}]` : address;
  const host = bareHost(u);
  return { url: pinned.href, host: u.host, tls: isIP(host) ? undefined : { serverName: host } };
}

function redirectTarget(location: string, current: URL): URL {
  if (!URL.canParse(location, current.href))
    throw new KiboError("PERMISSION_DENIED", "invalid redirect location");
  return new URL(location, current);
}

function failure(error: unknown, host: string, signal: AbortSignal): KiboError {
  if (error instanceof KiboError) return error;
  if (signal.aborted) return new KiboError("TIMEOUT", `fetch to ${host} timed out`);
  const code =
    error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "unknown";
  return new KiboError("INTERNAL", `fetch to ${host} failed (${code})`);
}

export async function proxyFetch(
  rules: readonly string[] | null,
  url: string,
  init: FetchInit,
  opts: NetProxyOptions = {},
): Promise<FetchResponse> {
  const resolve = opts.resolve ?? systemResolver;
  const transport = opts.transport ?? fetch;
  const allow = opts.allowAddress ?? isPublicAddress;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let current = checkedUrl(rules, url);
  let headers = outgoingHeaders(init.headers);
  let method = init.method;
  let body = init.body;
  try {
    for (let hop = 0; ; hop += 1) {
      const address = await checkedAddress(current, resolve, allow, signal);
      const pinned = pinnedRequest(current, address);
      const res = await transport(pinned.url, {
        method,
        headers: { ...headers, host: pinned.host },
        body,
        redirect: "manual",
        signal,
        tls: pinned.tls,
      });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || location === null) {
        return await readProxiedBody(res, opts.maxBytes ?? DEFAULT_MAX_BYTES);
      }
      await res.body?.cancel();
      if (hop >= maxRedirects) throw new KiboError("PERMISSION_DENIED", "too many redirects");
      const next = checkedUrl(rules, redirectTarget(location, current).href);
      if (next.origin !== current.origin) headers = {};
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
      current = next;
    }
  } catch (error) {
    throw failure(error, bareHost(current), signal);
  }
}
