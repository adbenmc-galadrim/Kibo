import { type ComponentManifest, KiboError } from "@kibo/schema";
import {
  bareHost,
  checkedAddress,
  isPublicAddress,
  pinnedRequest,
  type Resolver,
  systemResolver,
} from "../components/net-proxy-address";
import { readCapped, scrubCapped } from "../components/net-proxy-body";
import { directTransport, type Transport } from "../components/net-proxy-transport";
import type { IntegrationFetch, IntegrationFetchInit, InternalRule, SecretResolver } from "./types";

export const GITHUB_API = "api.github.com";
export const GITHUB_RULES: InternalRule[] = [{ host: GITHUB_API, suffix: false, auth: true }];
export const GITHUB_LOG_RULES: InternalRule[] = [
  ...GITHUB_RULES,
  { host: "actions.githubusercontent.com", suffix: true, auth: false },
];

const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const LOOPBACK_NAMES = new Set(["127.0.0.1", "localhost"]);
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const STRIPPED = new Set(["cookie", "authorization", "host", "proxy-authorization", "proxy-connection"]);
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
  if (!loopback || u.pathname !== "/" || u.search !== "" || u.hash !== "" || u.username !== "") {
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
  if (!entry || url.protocol !== "https:" || !covered(url)) return null;
  return (await resolve(entry.name)) || null;
}

function outgoing(init: Record<string, string> | undefined, bearer: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(init ?? {})) {
    if (!STRIPPED.has(name.toLowerCase())) headers[name.toLowerCase()] = value;
  }
  headers["user-agent"] = "kibo";
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  return headers;
}

function allowedRule(current: URL, rules: InternalRule[]): InternalRule {
  if (current.protocol !== "https:")
    throw new KiboError("PERMISSION_DENIED", `https only: ${current.origin}`);
  if (current.username !== "" || current.password !== "") {
    throw new KiboError("PERMISSION_DENIED", "credentials in url are not allowed");
  }
  const rule = rules.find((r) => hostMatches(r, current.hostname));
  if (!rule) throw new KiboError("PERMISSION_DENIED", `host not allowed: ${current.hostname}`);
  return rule;
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
    try {
      for (let hop = 0; hop <= MAX_HOPS; hop++) {
        const rule = allowedRule(current, rules);
        const bearer = rule.auth && init.bearer ? init.bearer : null;
        const res = await send(deps, current, {
          method: hop === 0 ? (init.method ?? "GET") : "GET",
          headers: outgoing(init.headers, bearer),
          body: hop === 0 ? init.body : undefined,
          signal,
        });
        deps.observe?.(bareHost(current), res.headers);
        if (!REDIRECTS.has(res.status)) {
          const { bytes, truncated } = scrubCapped(
            await readCapped(res, init.maxBytes ?? DEFAULT_MAX_BYTES),
            bearer,
          );
          return {
            status: res.status,
            headers: res.headers,
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
        current = new URL(location, current);
      }
      throw new KiboError("REMOTE_REJECTED", "too many redirects");
    } catch (error) {
      throw failure(error, bareHost(current), signal);
    }
  };
}
