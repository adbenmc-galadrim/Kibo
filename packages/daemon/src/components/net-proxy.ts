import {
  type ComponentManifest,
  type FetchInit,
  type FetchResponse,
  KiboError,
  ruleCovers,
} from "@kibo/schema";
import { secretFor, transportUrl } from "../integrations/net";
import type { ComponentIntegrationHooks } from "../integrations/types";
import {
  bareHost,
  checkedAddress,
  isPublicAddress,
  pinnedRequest,
  type Resolver,
  systemResolver,
} from "./net-proxy-address";
import { readProxiedBody } from "./net-proxy-body";
import { directTransport, type Transport } from "./net-proxy-transport";

export {
  bareHost,
  checkedAddress,
  isPublicAddress,
  pinnedRequest,
  type Resolver,
  systemResolver,
} from "./net-proxy-address";
export type { Transport, TransportInit } from "./net-proxy-transport";

export type ProxyHooks = Pick<ComponentIntegrationHooks, "aliases" | "observe" | "secret">;
export type NetProxyOptions = {
  hooks?: ProxyHooks;
  secrets?: ComponentManifest["secrets"];
  aliasFetch?: typeof fetch;
  resolve?: Resolver;
  transport?: Transport;
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

type Hop = { method: string; headers: Record<string, string>; body: string | undefined; signal: AbortSignal };

async function send(opts: NetProxyOptions, current: URL, hop: Hop): Promise<Response> {
  const { target, aliased } = transportUrl(current, opts.hooks?.aliases ?? new Map());
  if (aliased) return (opts.aliasFetch ?? fetch)(target, { ...hop, redirect: "manual" });
  const allow = opts.allowAddress ?? isPublicAddress;
  const address = await checkedAddress(current, opts.resolve ?? systemResolver, allow, hop.signal);
  const pinned = pinnedRequest(current, address);
  return (opts.transport ?? directTransport)(pinned.url, {
    ...hop,
    headers: { ...hop.headers, host: pinned.host },
    redirect: "manual",
    tls: pinned.tls,
  });
}

function injectedSecret(
  opts: NetProxyOptions,
  rules: readonly string[] | null,
  current: URL,
): Promise<string | null> {
  const hooks = opts.hooks;
  if (!hooks) return Promise.resolve(null);
  const covered = (u: URL) => rules === null || rules.some((rule) => ruleCovers(rule, u.href));
  return secretFor(current, opts.secrets ?? [], covered, hooks.secret);
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
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let current = checkedUrl(rules, url);
  let headers = outgoingHeaders(init.headers);
  let method = init.method;
  let body = init.body;
  try {
    for (let hop = 0; ; hop += 1) {
      const bearer = await injectedSecret(opts, rules, current);
      const res = await send(opts, current, {
        method,
        headers: bearer === null ? headers : { ...headers, authorization: `Bearer ${bearer}` },
        body,
        signal,
      });
      opts.hooks?.observe(bareHost(current), res.headers);
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || location === null) {
        return await readProxiedBody(res, opts.maxBytes ?? DEFAULT_MAX_BYTES, bearer);
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
