import { type ComponentManifest, GITHUB_SECRET_HOSTS, KiboError } from "@kibo/schema";
import {
  bareHost,
  checkedAddress,
  isPublicAddress,
  pinnedRequest,
  type Resolver,
  systemResolver,
} from "../components/net-proxy-address";
import { readCapped, refuseEncodedBody, scrubCapped, scrubHeaders } from "../components/net-proxy-body";
import { directTransport, type Transport } from "../components/net-proxy-transport";
import { isLoopbackAddress } from "../mcp/http-fetch";
import type {
  AuthHeader,
  IntegrationFetch,
  IntegrationFetchInit,
  InternalRule,
  SecretResolver,
} from "./types";

export const GITHUB_API = "api.github.com";
export const GITHUB_RULES: InternalRule[] = [{ host: GITHUB_API, suffix: false, auth: true }];
export const GITHUB_LOG_RULES: InternalRule[] = [
  ...GITHUB_RULES,
  { host: "actions.githubusercontent.com", suffix: true, auth: false },
];

export const BEARER_AUTH: AuthHeader = { header: "authorization", prefix: "Bearer " };
export const FIGMA_AUTH: AuthHeader = { header: "x-figma-token", prefix: "" };
export const PENPOT_AUTH: AuthHeader = { header: "authorization", prefix: "Token " };
export const FIGMA_API = "api.figma.com";
const STORAGE_RULE: InternalRule = { host: "amazonaws.com", suffix: true, auth: false };
export const FIGMA_RULES: InternalRule[] = [
  { host: FIGMA_API, suffix: false, auth: true },
  { host: "figma.com", suffix: true, auth: false },
  STORAGE_RULE,
];

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
export const isLoopbackHost = (hostname: string): boolean => LOOPBACK_HOSTS.has(hostname);

export function penpotRules(instance: URL): InternalRule[] {
  const loopback = isLoopbackHost(instance.hostname);
  return [
    { host: instance.hostname, suffix: false, auth: true, ...(loopback && { insecureLoopback: true }) },
    STORAGE_RULE,
  ];
}

const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const LOOPBACK_NAMES = new Set(["127.0.0.1", "localhost"]);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const STRIPPED = new Set([
  "cookie",
  "authorization",
  "x-figma-token",
  "host",
  "proxy-authorization",
  "proxy-connection",
]);
const MAX_HOPS = 3;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export type IntegrationFetchDeps = {
  aliases: Map<string, URL>;
  resolve?: Resolver;
  transport?: Transport;
  aliasFetch?: typeof fetch;
  observe?: (host: string, headers: Headers) => void;
};

function testOrigin(value: string): [string, URL] {
  const [host, origin, extra] = value.split("=");
  if (!host || !origin || extra !== undefined || !HOST.test(host) || !URL.canParse(origin)) {
    throw new KiboError("INVALID_INPUT", `bad test origin ${value}`);
  }
  const u = new URL(origin);
  const loopback = u.protocol === "http:" && LOOPBACK_NAMES.has(u.hostname);
  const credentials = u.username !== "" || u.password !== "";
  if (!loopback || credentials || u.pathname !== "/" || u.search !== "" || u.hash !== "") {
    throw new KiboError("INVALID_INPUT", `test origin must be a loopback http origin: ${value}`);
  }
  return [host, u];
}

export function parseTestOrigins(values: string[]): Map<string, URL> {
  return new Map(values.map(testOrigin));
}

export function hostMatches(rule: InternalRule, host: string): boolean {
  return rule.suffix ? host.endsWith(`.${rule.host}`) : host === rule.host;
}

export function transportUrl(url: URL, aliases: Map<string, URL>): { target: URL; aliased: boolean } {
  const alias = aliases.get(url.hostname);
  if (!alias) return { target: url, aliased: false };
  return { target: new URL(`${url.pathname}${url.search}`, alias), aliased: true };
}

export async function secretFor(
  url: URL,
  secrets: ComponentManifest["secrets"],
  covered: (url: URL) => boolean,
  resolve: SecretResolver,
): Promise<string | null> {
  const entry = secrets.find((s) => s.hosts.includes(url.hostname));
  if (entry?.name === "github" && !GITHUB_SECRET_HOSTS.includes(url.hostname)) {
    throw new KiboError("PERMISSION_DENIED", `github secret refused for ${url.hostname}`);
  }
  if (!entry || url.protocol !== "https:" || !covered(url)) return null;
  return (await resolve(entry.name)) || null;
}

function outgoing(
  init: Record<string, string> | undefined,
  bearer: string | null,
  auth: AuthHeader = BEARER_AUTH,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const authName = auth.header.toLowerCase();
  for (const [name, value] of Object.entries(init ?? {})) {
    const lower = name.toLowerCase();
    if (!STRIPPED.has(lower) && lower !== authName) headers[lower] = value;
  }
  headers["user-agent"] = "kibo";
  if (bearer) {
    headers[authName] = `${auth.prefix}${bearer}`;
    headers["accept-encoding"] = "identity";
  }
  return headers;
}

function allowedRule(current: URL, rules: InternalRule[]): InternalRule {
  if (current.protocol !== "https:" && current.protocol !== "http:")
    throw new KiboError("PERMISSION_DENIED", `https or loopback http only: ${current.origin}`);
  if (current.username !== "" || current.password !== "") {
    throw new KiboError("PERMISSION_DENIED", "credentials in url are not allowed");
  }
  const rule = rules.find((r) => hostMatches(r, current.hostname));
  if (!rule) throw new KiboError("PERMISSION_DENIED", `host not allowed: ${current.hostname}`);
  if (current.protocol === "http:" && !(rule.insecureLoopback === true && isLoopbackHost(current.hostname)))
    throw new KiboError("PERMISSION_DENIED", "http only on a loopback instance");
  return rule;
}

function nextHop(current: URL, location: string): URL {
  const next = new URL(location, current);
  if (current.protocol === "http:" && next.origin !== current.origin)
    throw new KiboError("PERMISSION_DENIED", "a loopback instance never redirects off its origin");
  return next;
}

async function checkLoopbackName(current: URL, resolve: Resolver): Promise<void> {
  if (current.hostname !== "localhost") return;
  const addresses = await resolve("localhost");
  if (addresses.length === 0 || !addresses.every(isLoopbackAddress))
    throw new KiboError("PERMISSION_DENIED", "localhost does not resolve to a loopback address");
}

function failure(error: unknown, host: string, signal: AbortSignal): KiboError {
  if (error instanceof KiboError) return error;
  if (signal.aborted) return new KiboError("TIMEOUT", `request to ${host} timed out`);
  const code =
    error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "unknown";
  return new KiboError("REMOTE_UNAVAILABLE", `request to ${host} failed (${code})`);
}

type Hop = { method: string; headers: Record<string, string>; body: string | undefined; signal: AbortSignal };

async function send(deps: IntegrationFetchDeps, current: URL, hop: Hop): Promise<Response> {
  const { target, aliased } = transportUrl(current, deps.aliases);
  if (aliased) return (deps.aliasFetch ?? fetch)(target, { ...hop, redirect: "manual" });
  if (current.protocol === "http:") {
    await checkLoopbackName(current, deps.resolve ?? systemResolver);
    return (deps.aliasFetch ?? fetch)(current, { ...hop, redirect: "manual" });
  }
  const address = await checkedAddress(current, deps.resolve ?? systemResolver, isPublicAddress, hop.signal);
  const pinned = pinnedRequest(current, address);
  return (deps.transport ?? directTransport)(pinned.url, {
    ...hop,
    headers: { ...hop.headers, host: pinned.host },
    redirect: "manual",
    tls: pinned.tls,
  });
}

function deadline(init: IntegrationFetchInit): AbortSignal {
  const timeout = AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  return init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
}

export function createIntegrationFetch(deps: IntegrationFetchDeps): IntegrationFetch {
  return async (url, init, rules) => {
    if (!URL.canParse(url)) throw new KiboError("INVALID_INPUT", "invalid url");
    let current = new URL(url);
    const signal = deadline(init);
    const secret = init.bearer || null;
    let token = secret;
    try {
      for (let hop = 0; hop <= MAX_HOPS; hop++) {
        const rule = allowedRule(current, rules);
        if (!rule.auth) token = null;
        const bearer = token;
        const res = await send(deps, current, {
          method: hop === 0 ? (init.method ?? "GET") : "GET",
          headers: outgoing(init.headers, bearer, init.auth),
          body: hop === 0 ? init.body : undefined,
          signal,
        });
        if (bearer) deps.observe?.(bareHost(current), res.headers);
        if (!REDIRECTS.has(res.status)) {
          await refuseEncodedBody(res, bearer);
          const { bytes, truncated } = scrubCapped(
            await readCapped(res, init.maxBytes ?? DEFAULT_MAX_BYTES),
            secret,
          );
          return {
            status: res.status,
            headers: secret ? scrubHeaders(res.headers, secret) : res.headers,
            body: bytes,
            truncated,
            url: current.toString(),
          };
        }
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location || !URL.canParse(location, current.href)) {
          throw new KiboError("REMOTE_REJECTED", "redirect without a valid location");
        }
        current = nextHop(current, location);
      }
      throw new KiboError("REMOTE_REJECTED", "too many redirects");
    } catch (error) {
      throw failure(error, bareHost(current), signal);
    }
  };
}
