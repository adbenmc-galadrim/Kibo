import {
  EMBED_CHECK_ERROR_TTL_MS,
  EMBED_CHECK_MAX,
  EMBED_CHECK_MAX_BYTES,
  EMBED_CHECK_TIMEOUT_MS,
  EMBED_CHECK_TTL_MS,
  type EmbedCheck,
  KiboError,
} from "@kibo/schema";
import type { IntegrationFetch } from "../integrations/types";
import type { EmbedChecker } from "./types";

const HOST_SOURCE = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+|\*))?(?:\/.*)?$/;
const REFUSED: EmbedCheck = { ok: false, code: "EMBED_REFUSED" };

function sourceAllows(source: string, origin: URL): boolean {
  if (source === "*") return true;
  if (source === origin.protocol) return true;
  const match = HOST_SOURCE.exec(source);
  if (!match || source.startsWith("'")) return false;
  const [, scheme, host, port] = match;
  if (scheme !== undefined && `${scheme}:` !== origin.protocol) return false;
  if (host !== origin.hostname) return false;
  return port === "*" || port === origin.port;
}

function ancestorsOf(policy: string): string[] | null {
  for (const directive of policy.split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name?.toLowerCase() === "frame-ancestors") return sources;
  }
  return null;
}

function policyAllows(policy: string, uiOrigins: readonly URL[]): boolean {
  const sources = ancestorsOf(policy);
  if (sources === null) return true;
  return sources.some((source) => source === "*" || uiOrigins.some((o) => sourceAllows(source, o)));
}

function frameOptionsRefuse(value: string | null): boolean {
  if (value === null) return false;
  return value.split(",").some((v) => ["deny", "sameorigin"].includes(v.trim().toLowerCase()));
}

export function embedCheckOf(status: number, headers: Headers, uiOrigins: readonly string[]): EmbedCheck {
  if (status === 404) return { ok: false, code: "REMOTE_NOT_FOUND" };
  if (status === 401 || status === 403) return { ok: false, code: "REMOTE_REJECTED" };
  if (status >= 500) return { ok: false, code: "REMOTE_UNAVAILABLE" };
  if (frameOptionsRefuse(headers.get("x-frame-options"))) return REFUSED;
  const csp = headers.get("content-security-policy");
  if (csp === null) return { ok: true };
  const origins = uiOrigins.map((o) => new URL(o));
  return csp.split(",").every((policy) => policyAllows(policy, origins)) ? { ok: true } : REFUSED;
}

const DETAILS: Record<Exclude<EmbedCheck, { ok: true }>["code"], string> = {
  EMBED_REFUSED: "the remote site refuses to be embedded outside of its own pages",
  REMOTE_NOT_FOUND: "the embedded page was not found",
  REMOTE_REJECTED: "the embedded page refused the request",
  REMOTE_UNAVAILABLE: "the embedded page is unavailable",
};

type Cached = { check: EmbedCheck; expiresAt: number };

export function createEmbedChecker(deps: {
  fetch: IntegrationFetch;
  now(): number;
  uiOrigins(): string[];
}): EmbedChecker {
  const cache = new Map<string, Cached>();
  const remember = (target: string, check: EmbedCheck) => {
    cache.delete(target);
    cache.set(target, {
      check,
      expiresAt: deps.now() + (check.ok ? EMBED_CHECK_TTL_MS : EMBED_CHECK_ERROR_TTL_MS),
    });
    for (const oldest of cache.keys()) {
      if (cache.size <= EMBED_CHECK_MAX) break;
      cache.delete(oldest);
    }
  };
  const ask = async (target: string): Promise<EmbedCheck> => {
    const res = await deps.fetch(
      target,
      { method: "GET", timeoutMs: EMBED_CHECK_TIMEOUT_MS, maxBytes: EMBED_CHECK_MAX_BYTES },
      [{ host: new URL(target).hostname, suffix: false, auth: false }],
    );
    const check = embedCheckOf(res.status, res.headers, deps.uiOrigins());
    remember(target, check);
    return check;
  };
  return {
    async check(target, refresh) {
      const cached = cache.get(target);
      const fresh = !refresh && cached !== undefined && deps.now() < cached.expiresAt;
      const check = fresh ? cached.check : await ask(target);
      if (!check.ok) throw new KiboError(check.code, `${DETAILS[check.code]}: ${new URL(target).hostname}`);
    },
  };
}
