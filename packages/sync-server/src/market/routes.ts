import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { KPKG_MAX_RAW_BYTES } from "@kibo/trust";
import type { ServerDb } from "../db";
import { validate } from "../validate";
import { readBoundedBody } from "./bounded-body";
import type { MarketLimits } from "./market-limits";
import { type NonceCache, precheckSignedRequest, verifySignedRequest } from "./signed-request";
import { RevokeInput, type TeamMarket } from "./team-market";

export type MarketRouteDeps = {
  sdb: ServerDb;
  market: TeamMarket;
  nonces: NonceCache;
  now: () => number;
  limits: MarketLimits;
  ip: string;
};
type Actor = { userId: string; deviceId: string };

export const MARKET_REVOKE_MAX_BYTES = 4096;
const PUBLISH_PATH = "/v1/market/packages";
const REVOKE_PATH = "/v1/market/revoke";
const PACKAGE_PATH = /^\/market\/packages\/([^/]{1,128})\/([^/]{1,32})\.kpkg$/;
const PACKAGE_ID = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/;
const VERSION = /^\d+\.\d+\.\d+$/;

const STATUS: Partial<Record<KiboErrorCode, number>> = {
  UNAUTHORIZED: 401,
  DEVICE_REVOKED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_EXISTS: 409,
  PUBLISHER_CHANGED: 409,
  CONFLICT: 409,
  REVOKED: 410,
  TOO_LARGE: 413,
  SIGNATURE_INVALID: 422,
  HASH_MISMATCH: 422,
  RATE_LIMITED: 429,
  INVALID_INPUT: 400,
};

const COMMON_HEADERS = { "x-content-type-options": "nosniff" };
const ok = (result: unknown) =>
  Response.json({ ok: true, result }, { headers: { ...COMMON_HEADERS, "cache-control": "no-store" } });
const fail = (code: KiboErrorCode, message: string, status: number) =>
  Response.json({ ok: false, error: { code, message } }, { status, headers: COMMON_HEADERS });
const file = (body: Uint8Array<ArrayBuffer> | string, type: string) =>
  new Response(body, { headers: { ...COMMON_HEADERS, "content-type": type, "cache-control": "no-cache" } });

function readRoute(url: URL, market: TeamMarket): Response | null {
  if (url.pathname === "/market/index.json") return file(market.index().bytes, "application/json");
  if (url.pathname === "/market/index.json.sig") return file(market.index().sig, "text/plain; charset=utf-8");
  const match = PACKAGE_PATH.exec(url.pathname);
  if (!match) return null;
  const [, id = "", version = ""] = match;
  const found = PACKAGE_ID.test(id) && VERSION.test(version) ? market.packageBytes(id, version) : null;
  return found ? file(found, "application/json") : fail("NOT_FOUND", "package not found", 404);
}

async function authenticate(
  req: Request,
  deps: MarketRouteDeps,
  maxBytes: number,
): Promise<{ body: Uint8Array; actor: Actor }> {
  const { limits, ip } = deps;
  if (limits.failures.blocked(ip)) throw new KiboError("RATE_LIMITED", "too many authentication failures");
  try {
    precheckSignedRequest(deps.sdb, req, deps.now());
    const body = await readBoundedBody(req, maxBytes);
    const actor = await verifySignedRequest(deps.sdb, req, body, deps.nonces, deps.now());
    return { body, actor };
  } catch (e) {
    if (e instanceof KiboError && e.code === "UNAUTHORIZED") limits.failures.fail(ip);
    throw e;
  }
}

async function writeRoute(
  req: Request,
  deps: MarketRouteDeps,
  maxBytes: number,
  action: (body: Uint8Array, actor: Actor) => Promise<unknown>,
): Promise<Response> {
  const { body, actor } = await authenticate(req, deps, maxBytes);
  if (!deps.limits.writes.take(actor.userId)) throw new KiboError("RATE_LIMITED", "too many market writes");
  return ok(await action(body, actor));
}

function parseRevoke(body: Uint8Array): RevokeInput {
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `revoke body is not JSON: ${String(e)}`);
  }
  return validate(RevokeInput, json);
}

function failure(e: unknown, pathname: string): Response {
  const status = e instanceof KiboError ? STATUS[e.code] : undefined;
  if (e instanceof KiboError && status !== undefined) return fail(e.code, e.detail, status);
  console.error("[kibo-sync] market route failed", pathname, e);
  return fail("INTERNAL", "internal error", 500);
}

export async function handleMarketRoute(
  req: Request,
  url: URL,
  deps: MarketRouteDeps,
): Promise<Response | null> {
  const { market } = deps;
  try {
    if (req.method === "GET") return readRoute(url, market);
    if (req.method === "POST" && url.pathname === PUBLISH_PATH) {
      return await writeRoute(req, deps, KPKG_MAX_RAW_BYTES, (body, actor) =>
        market.publish(body, actor, deps.now()),
      );
    }
    if (req.method === "POST" && url.pathname === REVOKE_PATH) {
      return await writeRoute(req, deps, MARKET_REVOKE_MAX_BYTES, (body, actor) =>
        market.revoke(parseRevoke(body), actor, deps.now()),
      );
    }
    return null;
  } catch (e) {
    return failure(e, url.pathname);
  }
}
