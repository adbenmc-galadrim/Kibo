import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateKeyPair,
  HTTP_SIGNATURE_HEADERS,
  httpSigningPayload,
  type KeyPair,
  KPKG_MAX_RAW_BYTES,
  owned,
  sha256Hex,
  signBytes,
  signRequest,
  toBase64,
} from "@kibo/trust";
import { makeTestPackage } from "@kibo/trust/testing";
import { createInvite, disableUser, redeemDeviceInvite, revokeDevice } from "../accounts";
import { openServerDb, type ServerDb } from "../db";
import { createMarketLimits, MARKET_LIMITS } from "./market-limits";
import { handleMarketRoute, type MarketRouteDeps } from "./routes";
import { NONCE_TTL_MS, NonceCache, SIGNED_REQUEST_SKEW_MS } from "./signed-request";
import { initMarketSource, TeamMarket } from "./team-market";

const BASE = "https://sync.kibo.test";
const PUBLISH = "/v1/market/packages";
const REVOKE = "/v1/market/revoke";
let dir: string;
let sdb: ServerDb;
let deps: MarketRouteDeps;
let now: number;
let device: { userId: string; deviceId: string; keys: KeyPair };

beforeEach(async () => {
  now = 1_800_000_000_000;
  dir = mkdtempSync(join(tmpdir(), "kibo-market-routes-"));
  sdb = openServerDb(join(dir, "sync.db"));
  await initMarketSource(dir, { id: "equipe", name: "Équipe" });
  const market = await TeamMarket.open(sdb, dir);
  if (!market) throw new Error("market source was not initialised");
  const invite = await createInvite(sdb, { kind: "account", name: "Léa", createdBy: "admin" }, now);
  const keys = await generateKeyPair();
  const joined = await redeemDeviceInvite(
    sdb,
    { code: invite.code, publicKey: keys.publicKey, deviceName: "Mac" },
    now,
  );
  device = { userId: joined.userId, deviceId: joined.deviceId, keys };
  market.grant(joined.userId, "publisher");
  const clock = () => now;
  deps = {
    sdb,
    market,
    nonces: new NonceCache({ ttlMs: NONCE_TTL_MS, now: clock }),
    now: clock,
    limits: createMarketLimits(clock),
    ip: "203.0.113.7",
  };
});
afterEach(() => {
  sdb.close();
  rmSync(dir, { recursive: true, force: true });
});

type SignOptions = {
  at?: number;
  method?: string;
  signedPath?: string;
  signedBody?: Uint8Array;
  sentBody?: BodyInit;
  headers?: Record<string, string>;
};

async function signed(path: string, body: Uint8Array, opts: SignOptions = {}) {
  const auth = await signRequest({
    deviceId: device.deviceId,
    privateKey: device.keys.privateKey,
    method: opts.method ?? "POST",
    path: opts.signedPath ?? path,
    body: opts.signedBody ?? body,
    now: opts.at ?? now,
  });
  const headers = { ...auth, ...opts.headers };
  return new Request(`${BASE}${path}`, { method: "POST", headers, body: opts.sentBody ?? owned(body) });
}
async function signedWithNonce(body: Uint8Array, nonce: string) {
  const date = String(now);
  const payload = httpSigningPayload({
    method: "POST",
    path: PUBLISH,
    date,
    nonce,
    bodySha256: await sha256Hex(body),
  });
  const h = HTTP_SIGNATURE_HEADERS;
  const headers = {
    [h.device]: device.deviceId,
    [h.date]: date,
    [h.nonce]: nonce,
    [h.signature]: await signBytes(device.keys.privateKey, payload),
  };
  return new Request(`${BASE}${PUBLISH}`, { method: "POST", headers, body: owned(body) });
}
const route = (req: Request) => handleMarketRoute(req, new URL(req.url), deps);
const errorOf = async (res: Response | null) =>
  ((await res?.json()) as { error?: { code: string; message: string } }).error;
const codeOf = async (res: Response | null) => (await errorOf(res))?.code;
const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("reading", () => {
  test("unrelated paths are not handled", async () => {
    expect(await route(new Request(`${BASE}/v1/sync`))).toBeNull();
  });
  test("a signed publication is accepted and served back byte for byte", async () => {
    const { bytes } = await makeTestPackage();
    const res = await route(await signed(PUBLISH, bytes));
    expect(res?.status).toBe(200);
    expect(await res?.json()).toEqual({ ok: true, result: { serial: 2 } });
    const index = await route(new Request(`${BASE}/market/index.json`));
    const { bytes: expected, sig } = deps.market.index();
    expect(new Uint8Array(await (index as Response).arrayBuffer())).toEqual(owned(expected));
    expect(await (await route(new Request(`${BASE}/market/index.json.sig`)))?.text()).toBe(sig);
    const file = await route(new Request(`${BASE}/market/packages/burndown/0.3.0.kpkg`));
    expect(new Uint8Array(await (file as Response).arrayBuffer())).toEqual(owned(bytes));
  });
  test("a missing or malformed package path is 404", async () => {
    expect((await route(new Request(`${BASE}/market/packages/nope/1.0.0.kpkg`)))?.status).toBe(404);
    expect((await route(new Request(`${BASE}/market/packages/Nope/1.0.kpkg`)))?.status).toBe(404);
  });
  test("an internal failure is 500 without details", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    sdb.db.exec("DELETE FROM market_state");
    const res = await route(new Request(`${BASE}/market/index.json`));
    expect(res?.status).toBe(500);
    expect(await errorOf(res)).toEqual({ code: "INTERNAL", message: "internal error" });
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe("request signature", () => {
  test("an unsigned publication is 401", async () => {
    const { bytes } = await makeTestPackage();
    const res = await route(new Request(`${BASE}${PUBLISH}`, { method: "POST", body: owned(bytes) }));
    expect(res?.status).toBe(401);
  });
  test("a malformed date header is 401", async () => {
    const { bytes } = await makeTestPackage();
    const res = await route(
      await signed(PUBLISH, bytes, { headers: { [HTTP_SIGNATURE_HEADERS.date]: "1.8e12" } }),
    );
    expect(await codeOf(res)).toBe("UNAUTHORIZED");
  });
  test("a replayed request is 401", async () => {
    const { bytes } = await makeTestPackage();
    const first = await signed(PUBLISH, bytes);
    const replay = first.clone();
    expect((await route(first))?.status).toBe(200);
    const res = await route(replay);
    expect(res?.status).toBe(401);
    expect(await codeOf(res)).toBe("UNAUTHORIZED");
  });
  test("a nonce is refused whatever the signature it comes with", async () => {
    const nonce = toBase64(new Uint8Array(16).fill(7));
    const first = await makeTestPackage();
    expect((await route(await signedWithNonce(first.bytes, nonce)))?.status).toBe(200);
    const other = await makeTestPackage({ id: "velocity" });
    const res = await route(await signedWithNonce(other.bytes, nonce));
    expect(res?.status).toBe(401);
    expect((await errorOf(res))?.message).toBe("request nonce was already used");
  });
  test("a replay stays refused until the request date leaves the skew window", async () => {
    const { bytes } = await makeTestPackage();
    const at = now;
    const first = await signed(PUBLISH, bytes, { at });
    const replay = first.clone();
    now = at - SIGNED_REQUEST_SKEW_MS;
    expect((await route(first))?.status).toBe(200);
    now = at + SIGNED_REQUEST_SKEW_MS;
    expect(await codeOf(await route(replay))).toBe("UNAUTHORIZED");
  });
  test("a date skewed by more than 5 minutes is 401", async () => {
    const { bytes } = await makeTestPackage();
    expect(
      (await route(await signed(PUBLISH, bytes, { at: now - SIGNED_REQUEST_SKEW_MS - 1 })))?.status,
    ).toBe(401);
    expect(
      (await route(await signed(PUBLISH, bytes, { at: now + SIGNED_REQUEST_SKEW_MS + 1 })))?.status,
    ).toBe(401);
  });
  test("a signature over another body is 401", async () => {
    const { bytes } = await makeTestPackage();
    const forged = await signed(PUBLISH, bytes, { signedBody: new Uint8Array([1, 2, 3]) });
    expect((await route(forged))?.status).toBe(401);
  });
  test("the query string is part of the signed path", async () => {
    const { bytes } = await makeTestPackage();
    const added = await signed(`${PUBLISH}?dry=1`, bytes, { signedPath: PUBLISH });
    expect((await route(added))?.status).toBe(401);
    expect((await route(await signed(`${PUBLISH}?dry=1`, bytes)))?.status).toBe(200);
  });
  test("the method is signed in upper case", async () => {
    const { bytes } = await makeTestPackage();
    expect((await route(await signed(PUBLISH, bytes, { method: "post" })))?.status).toBe(401);
  });
  test("a revoked device is 401 DEVICE_REVOKED", async () => {
    revokeDevice(sdb, { deviceId: device.deviceId, by: "admin" }, now);
    const { bytes } = await makeTestPackage();
    const res = await route(await signed(PUBLISH, bytes));
    expect(res?.status).toBe(401);
    expect(await codeOf(res)).toBe("DEVICE_REVOKED");
  });
  test("a disabled user is 401 DEVICE_REVOKED", async () => {
    disableUser(sdb, device.userId, now);
    const { bytes } = await makeTestPackage();
    expect(await codeOf(await route(await signed(PUBLISH, bytes)))).toBe("DEVICE_REVOKED");
  });
});

describe("limits", () => {
  test("a package larger than the kpkg bound is 413", async () => {
    const big = new Uint8Array(KPKG_MAX_RAW_BYTES + 1);
    const res = await route(await signed(PUBLISH, big));
    expect(res?.status).toBe(413);
    expect(await codeOf(res)).toBe("TOO_LARGE");
  });
  test("a streamed body is cut at the bound", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
    });
    const req = await signed(PUBLISH, new Uint8Array(), { sentBody: stream });
    expect(await codeOf(await route(req))).toBe("TOO_LARGE");
  });
  test("a revocation body is bounded to a few kilobytes", async () => {
    const res = await route(await signed(REVOKE, json({ hash: "a".repeat(64), reason: "x".repeat(8000) })));
    expect(res?.status).toBe(413);
  });
  test("repeated authentication failures block the address", async () => {
    const { bytes } = await makeTestPackage();
    for (let i = 0; i < MARKET_LIMITS.authFailures; i++) {
      await route(await signed(PUBLISH, bytes, { signedPath: "/other" }));
    }
    const res = await route(await signed(PUBLISH, bytes));
    expect(res?.status).toBe(429);
    expect(await codeOf(res)).toBe("RATE_LIMITED");
  });
  test("writes are limited per user", async () => {
    const body = json({ hash: "a".repeat(64), reason: "x" });
    for (let i = 0; i < MARKET_LIMITS.writesPerWindow; i++) {
      expect((await route(await signed(REVOKE, body)))?.status).toBe(404);
    }
    expect(await codeOf(await route(await signed(REVOKE, body)))).toBe("RATE_LIMITED");
  });
});

describe("writing", () => {
  test("a user without role is 403", async () => {
    deps.market.ungrant(device.userId);
    const { bytes } = await makeTestPackage();
    expect((await route(await signed(PUBLISH, bytes)))?.status).toBe(403);
  });
  test("the publisher revokes through the API", async () => {
    const { bytes, pkg } = await makeTestPackage();
    await route(await signed(PUBLISH, bytes));
    const res = await route(
      await signed(REVOKE, json({ hash: pkg.hash, reason: "faille" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    expect(await res?.json()).toEqual({ ok: true, result: { serial: 3 } });
  });
  test("a malformed revocation is 400", async () => {
    expect(await codeOf(await route(await signed(REVOKE, new TextEncoder().encode("{"))))).toBe(
      "INVALID_INPUT",
    );
    expect(await codeOf(await route(await signed(REVOKE, json({ hash: "zz", reason: "x" }))))).toBe(
      "INVALID_INPUT",
    );
  });
  test("the same version twice is 409", async () => {
    const first = await makeTestPackage();
    await route(await signed(PUBLISH, first.bytes));
    const again = await makeTestPackage({ keys: first.keys, files: { "extra.ts": "export const y = 2;\n" } });
    const res = await route(await signed(PUBLISH, again.bytes));
    expect(res?.status).toBe(409);
    expect(await codeOf(res)).toBe("VERSION_EXISTS");
  });
  test("a tampered package is 422", async () => {
    const { pkg } = await makeTestPackage();
    const tampered = json({ ...pkg, files: pkg.files.map((f) => ({ ...f, sha256: "0".repeat(64) })) });
    const res = await route(await signed(PUBLISH, tampered));
    expect(res?.status).toBe(422);
    expect(await codeOf(res)).toBe("HASH_MISMATCH");
  });
});
