import { afterEach, describe, expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { startRemoteServer } from "./server";
import { sealedRequest } from "./testing/fixtures";
import {
  connectFakeMac,
  connectPhoneEvents,
  startTestServer,
  TEST_ORIGIN,
  type TestServer,
} from "./testing/test-server";

let server: TestServer | null = null;
afterEach(async () => {
  await server?.stop();
  server = null;
});

const BLOCK_MS = 5 * 60_000;

const register = (s: TestServer, setupCode: string, macToken = "a-mac-token-long-enough") =>
  fetch(`${s.url}/api/mac/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ setupCode, macToken }),
  });

const macAuth = (s: TestServer, token: string) =>
  fetch(`${s.url}/api/mac`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.status);

describe("register limits", () => {
  test("five wrong setup codes block registration for a while, even with the right code", async () => {
    const s = await startTestServer();
    server = s;
    for (let i = 0; i < 5; i++) expect((await register(s, "wrong")).status).toBe(403);
    const blocked = await register(s, s.setupCode);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
    s.advance(BLOCK_MS);
    expect((await register(s, s.setupCode)).status).toBe(200);
  });

  test("a register body over a few KiB is 413 before parsing", async () => {
    const s = await startTestServer();
    server = s;
    const res = await register(s, s.setupCode, "x".repeat(8_192));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "TOO_LARGE" } });
  });

  test("startRemoteServer refuses a setup code shorter than 20 characters", async () => {
    const start = (setupCode: string) =>
      startRemoteServer({
        port: 0,
        db: ":memory:",
        origin: TEST_ORIGIN,
        rpId: "127.0.0.1",
        setupCode,
        staticDir: null,
      });
    await expect(start("short-setup-code")).rejects.toBeInstanceOf(KiboError);
    const ok = await start("a-setup-code-long-enough");
    await ok.stop();
  });

  test("a missing staticDir fails at start", async () => {
    await expect(startTestServer({ staticDir: "/nonexistent/kibo-phone-dist" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});

describe("mac authentication limits", () => {
  test("five bad mac tokens block /api/mac for a while, even the right one", async () => {
    const s = await startTestServer();
    server = s;
    const { macToken } = await s.registerMac();
    for (let i = 0; i < 5; i++) expect(await macAuth(s, `bad-token-${i}`)).toBe(401);
    expect(await macAuth(s, macToken)).toBe(429);
    await expect(connectFakeMac(s.url, macToken)).rejects.toThrow();
    s.advance(BLOCK_MS);
    const mac = await connectFakeMac(s.url, macToken);
    await mac.close();
  });
});

describe("phone limits", () => {
  test("the phone event socket is closed as soon as it sends a frame", async () => {
    const s = await startTestServer();
    server = s;
    const phone = await connectPhoneEvents(s.url, s.phoneCookie());
    phone.send({ type: "anything" });
    expect(await phone.closed).toBe(1008);
  });

  test("events and requests from another origin are 403", async () => {
    const s = await startTestServer();
    server = s;
    const cookie = s.phoneCookie();
    await expect(connectPhoneEvents(s.url, cookie, "https://evil.example")).rejects.toThrow();
    const upgrade = await fetch(`${s.url}/api/phone/events`, {
      headers: { cookie, origin: "https://evil.example", upgrade: "websocket" },
    });
    expect(upgrade.status).toBe(403);
    for (const origin of ["https://evil.example", null]) {
      const res = await fetch(`${s.url}/api/phone/request`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie, ...(origin ? { origin } : {}) },
        body: JSON.stringify({ sealed: sealedRequest() }),
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
  });
});
