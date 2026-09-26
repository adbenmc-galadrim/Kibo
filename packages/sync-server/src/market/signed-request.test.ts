import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HTTP_SIGNATURE_HEADERS, KPKG_MAX_RAW_BYTES, toBase64 } from "@kibo/trust";
import { disableUser, revokeDevice } from "../accounts";
import { MARKET_LIMITS } from "./market-limits";
import { codeOf, errorOf, json, PUBLISH, REVOKE, RouteKit } from "./route-test-kit";
import { NonceCache, SIGNED_REQUEST_SKEW_MS } from "./signed-request";

let r: RouteKit;

beforeEach(async () => {
  r = await RouteKit.create("kibo-signed-request-");
});
afterEach(() => r.close());

const status = async (req: Promise<Request>) => (await r.route(await req))?.status;

describe("request signature", () => {
  test("a malformed date header is 401", async () => {
    const { bytes } = await r.pkg();
    const headers = { [HTTP_SIGNATURE_HEADERS.date]: "1.8e12" };
    expect(await codeOf(await r.route(await r.signed(PUBLISH, bytes, { headers })))).toBe("UNAUTHORIZED");
  });
  test("a replayed request is 401", async () => {
    const first = await r.signed(PUBLISH, (await r.pkg()).bytes);
    const replay = first.clone();
    expect((await r.route(first))?.status).toBe(200);
    expect(await codeOf(await r.route(replay))).toBe("UNAUTHORIZED");
  });
  test("a replay stays refused after a server restart", async () => {
    const first = await r.signed(PUBLISH, (await r.pkg()).bytes);
    const replay = first.clone();
    expect((await r.route(first))?.status).toBe(200);
    r.restart();
    expect((await errorOf(await r.route(replay)))?.message).toBe("request nonce was already used");
  });
  test("a nonce is refused whatever the signature it comes with", async () => {
    const nonce = toBase64(new Uint8Array(16).fill(7));
    expect(await status(r.signedRaw((await r.pkg()).bytes, { nonce }))).toBe(200);
    const res = await r.route(await r.signedRaw((await r.pkg({ id: "velocity" })).bytes, { nonce }));
    expect(res?.status).toBe(401);
    expect((await errorOf(res))?.message).toBe("request nonce was already used");
  });
  test("a replay stays refused until the request date leaves the skew window", async () => {
    const at = r.now;
    const first = await r.signed(PUBLISH, (await r.pkg()).bytes, { at });
    const replay = first.clone();
    r.now = at - SIGNED_REQUEST_SKEW_MS;
    expect((await r.route(first))?.status).toBe(200);
    r.now = at + SIGNED_REQUEST_SKEW_MS;
    expect(await codeOf(await r.route(replay))).toBe("UNAUTHORIZED");
  });
  test("a date skewed by more than 5 minutes is 401", async () => {
    const { bytes } = await r.pkg();
    expect(await status(r.signed(PUBLISH, bytes, { at: r.now - SIGNED_REQUEST_SKEW_MS - 1 }))).toBe(401);
    expect(await status(r.signed(PUBLISH, bytes, { at: r.now + SIGNED_REQUEST_SKEW_MS + 1 }))).toBe(401);
  });
  test("a signature over another body is 401", async () => {
    const { bytes } = await r.pkg();
    expect(await status(r.signed(PUBLISH, bytes, { signedBody: new Uint8Array([1, 2, 3]) }))).toBe(401);
  });
  test("the query string is part of the signed path", async () => {
    const { bytes } = await r.pkg();
    expect(await status(r.signed(`${PUBLISH}?dry=1`, bytes, { signedPath: PUBLISH }))).toBe(401);
    expect(await status(r.signed(`${PUBLISH}?dry=1`, bytes))).toBe(200);
  });
  test("the server checks the method in upper case", async () => {
    const nonce = toBase64(new Uint8Array(16).fill(9));
    expect(await status(r.signedRaw((await r.pkg()).bytes, { nonce, method: "post" }))).toBe(401);
  });
  test("a revoked device is 401 DEVICE_REVOKED", async () => {
    revokeDevice(r.kit.sdb, { deviceId: r.device.deviceId, by: "admin" }, r.now);
    const res = await r.route(await r.signed(PUBLISH, (await r.pkg()).bytes));
    expect(res?.status).toBe(401);
    expect(await codeOf(res)).toBe("DEVICE_REVOKED");
  });
  test("a disabled user is 401 DEVICE_REVOKED", async () => {
    disableUser(r.kit.sdb, r.device.userId, r.now);
    expect(await codeOf(await r.route(await r.signed(PUBLISH, (await r.pkg()).bytes)))).toBe(
      "DEVICE_REVOKED",
    );
  });
});

describe("nonce store", () => {
  test("an expired nonce is forgotten", () => {
    let now = 0;
    const nonces = new NonceCache({ sdb: r.kit.sdb, ttlMs: 1000, now: () => now });
    expect(nonces.seen("n1")).toBe(false);
    expect(nonces.seen("n1")).toBe(true);
    now = 1001;
    expect(nonces.seen("n1")).toBe(false);
  });
  test("the sweep deletes expired nonces", () => {
    let now = 0;
    const nonces = new NonceCache({ sdb: r.kit.sdb, ttlMs: 1000, now: () => now });
    nonces.seen("n1");
    now = 2000;
    nonces.seen("n2");
    const rows = r.kit.sdb.db.query<{ nonce: string }, []>("SELECT nonce FROM market_nonces").all();
    expect(rows.map((row) => row.nonce)).toEqual(["n2"]);
  });
});

describe("limits", () => {
  test("a package larger than the kpkg bound is 413", async () => {
    const res = await r.route(await r.signed(PUBLISH, new Uint8Array(KPKG_MAX_RAW_BYTES + 1)));
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
    const req = await r.signed(PUBLISH, new Uint8Array(), { sentBody: stream });
    expect(await codeOf(await r.route(req))).toBe("TOO_LARGE");
  });
  test("a revocation body is bounded to a few kilobytes", async () => {
    const body = json({ hash: "a".repeat(64), reason: "x".repeat(8000) });
    expect(await status(r.signed(REVOKE, body))).toBe(413);
  });
  test("repeated authentication failures block the address with Retry-After", async () => {
    const { bytes } = await r.pkg();
    for (let i = 0; i < MARKET_LIMITS.authFailures; i++) {
      await r.route(await r.signed(PUBLISH, bytes, { signedPath: "/other" }));
    }
    const res = await r.route(await r.signed(PUBLISH, bytes));
    expect(res?.status).toBe(429);
    expect(await codeOf(res)).toBe("RATE_LIMITED");
    expect(res?.headers.get("retry-after")).toBe(String(MARKET_LIMITS.blockMs / 1000));
  });
  test("oversized bodies count as authentication failures", async () => {
    const big = new Uint8Array(KPKG_MAX_RAW_BYTES + 1);
    for (let i = 0; i < MARKET_LIMITS.authFailures; i++) await r.route(await r.signed(PUBLISH, big));
    expect(await status(r.signed(PUBLISH, (await r.pkg()).bytes))).toBe(429);
  });
  test("a revoked device does not block the address", async () => {
    revokeDevice(r.kit.sdb, { deviceId: r.device.deviceId, by: "admin" }, r.now);
    const { bytes } = await r.pkg();
    for (let i = 0; i < MARKET_LIMITS.authFailures; i++) await r.route(await r.signed(PUBLISH, bytes));
    expect(await codeOf(await r.route(await r.signed(PUBLISH, bytes)))).toBe("DEVICE_REVOKED");
  });
  test("writes are limited per user with Retry-After", async () => {
    const body = json({ hash: "a".repeat(64), reason: "x" });
    for (let i = 0; i < MARKET_LIMITS.writesPerWindow; i++) {
      expect(await status(r.signed(REVOKE, body))).toBe(404);
    }
    const res = await r.route(await r.signed(REVOKE, body));
    expect(await codeOf(res)).toBe("RATE_LIMITED");
    expect(res?.headers.get("retry-after")).toBe(String(MARKET_LIMITS.writeWindowMs / 1000));
  });
  test("writes over the quota never record their nonce", async () => {
    const body = json({ hash: "a".repeat(64), reason: "x" });
    for (let i = 0; i < MARKET_LIMITS.writesPerWindow; i++) await r.route(await r.signed(REVOKE, body));
    const count = () =>
      r.kit.sdb.db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM market_nonces").get()?.n;
    const before = count();
    for (let i = 0; i < 5; i++) {
      expect(await codeOf(await r.route(await r.signed(REVOKE, body)))).toBe("RATE_LIMITED");
    }
    expect(count()).toBe(before);
  });
  test("a replayed nonce is refused without spending the write quota", async () => {
    const body = json({ hash: "a".repeat(64), reason: "x" });
    for (let i = 1; i < MARKET_LIMITS.writesPerWindow; i++) await r.route(await r.signed(REVOKE, body));
    const last = await r.signed(REVOKE, body);
    const replay = last.clone();
    expect((await r.route(last))?.status).toBe(404);
    expect(await codeOf(await r.route(replay))).toBe("UNAUTHORIZED");
  });
});
