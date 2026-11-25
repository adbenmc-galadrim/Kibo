import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { PAIR_TOKEN_TTL_MS } from "@kibo/remote/protocol";
import { fakeAssertion, fakeRegistration } from "./testing/fake-webauthn";
import { challengeFrom, cookieOf, expectError, phoneAuth } from "./testing/phone-auth";
import { startTestServer, TEST_ORIGIN, type TestServer } from "./testing/test-server";
import { createWebauthn } from "./webauthn";

const SESSION_MAX_AGE = 90 * 24 * 3_600;

let server: TestServer;
let auth: ReturnType<typeof phoneAuth>;
afterEach(async () => {
  await auth.close();
  await server.stop();
});

const post: ReturnType<typeof phoneAuth>["post"] = (...args) => auth.post(...args);
const session = (cookie: string) => auth.session(cookie);
const pairPhone = () => auth.pairPhone();
const login = (counter: number) => auth.login(counter);
const pairing = () => auth.pairing();

async function start(overrides: Parameters<typeof startTestServer>[0] = {}) {
  server = await startTestServer(overrides);
  auth = phoneAuth(server);
  return auth;
}

describe("pairing", () => {
  test("pair/options with an unknown or expired pairToken is 401 REMOTE_PAIRING_INVALID", async () => {
    await start();
    const pair = await pairing();
    await expectError(
      await post("pair/options", { ...pair, pairToken: "unknown" }),
      401,
      "REMOTE_PAIRING_INVALID",
    );
    await expectError(
      await post("pair/options", { ...pair, accountId: crypto.randomUUID() }),
      401,
      "REMOTE_PAIRING_INVALID",
    );
    server.advance(PAIR_TOKEN_TTL_MS);
    await expectError(await post("pair/options", pair), 401, "REMOTE_PAIRING_INVALID");
  });

  test("five wrong tokens then a right one is 429 RATE_LIMITED", async () => {
    await start();
    const pair = await pairing();
    for (let i = 0; i < 4; i++)
      await expectError(
        await post("pair/options", { ...pair, pairToken: `wrong-${i}` }),
        401,
        "REMOTE_PAIRING_INVALID",
      );
    await expectError(await post("pair/options", { ...pair, pairToken: "wrong-4" }), 429, "RATE_LIMITED");
    await expectError(await post("pair/options", pair), 429, "RATE_LIMITED");
  });

  test("pair/options asks for a resident key and can be retried before verify", async () => {
    await start();
    const pair = await pairing();
    const first = await post("pair/options", pair);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ authenticatorSelection: { residentKey: "required" } });
    expect((await post("pair/options", pair)).status).toBe(200);
  });

  test("pair/verify stores the passkey, consumes the token, opens a session (Set-Cookie kibo_phone HttpOnly Secure SameSite=Strict)", async () => {
    await start();
    const pair = await pairing();
    const options = { challenge: await challengeFrom(await post("pair/options", pair)) };
    const res = await post("pair/verify", {
      ...pair,
      response: fakeRegistration(options.challenge, TEST_ORIGIN),
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^kibo_phone=[A-Za-z0-9_-]{43}; /);
    for (const attribute of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", `Max-Age=${SESSION_MAX_AGE}`])
      expect(setCookie.split("; ")).toContain(attribute);
    expect((await session(cookieOf(res))).status).toBe(200);
    expect((await login(1)).status).toBe(200);
  });

  test("a second pair/options after a successful pair/verify is 401", async () => {
    await start();
    const { accountId, pairToken } = await pairPhone();
    await expectError(await post("pair/options", { accountId, pairToken }), 401, "REMOTE_PAIRING_INVALID");
  });

  test("a refused attestation keeps the token and opens no session", async () => {
    await start();
    const pair = await pairing();
    const options = { challenge: await challengeFrom(await post("pair/options", pair)) };
    const bad = await post("pair/verify", {
      ...pair,
      response: fakeRegistration(options.challenge, TEST_ORIGIN, "other-cred"),
    });
    await expectError(bad, 401, "UNAUTHORIZED");
    expect(bad.headers.get("set-cookie")).toBeNull();
    expect((await post("pair/options", pair)).status).toBe(200);
  });

  test("pair/verify needs a challenge issued by pair/options, once", async () => {
    await start();
    const pair = await pairing();
    const forged = await post("pair/verify", { ...pair, response: fakeRegistration("forged", TEST_ORIGIN) });
    await expectError(forged, 401, "REMOTE_PAIRING_INVALID");
    const loginOptions = { challenge: await challengeFrom(await post("login/options", {})) };
    const crossed = await post("pair/verify", {
      ...pair,
      response: fakeRegistration(loginOptions.challenge, TEST_ORIGIN),
    });
    await expectError(crossed, 401, "REMOTE_PAIRING_INVALID");
  });
});

describe("login", () => {
  test("login/options then login/verify opens a session and bumps the counter", async () => {
    await start();
    await pairPhone();
    const res = await login(3);
    expect(res.status).toBe(200);
    expect((await session(cookieOf(res))).status).toBe(200);
    await expectError(await login(3), 401, "UNAUTHORIZED");
    expect((await login(4)).status).toBe(200);
  });

  test("a counter lower than stored is refused", async () => {
    await start();
    await pairPhone();
    expect((await login(5)).status).toBe(200);
    const res = await login(2);
    await expectError(res, 401, "UNAUTHORIZED");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("an authenticator that always reports 0 can sign in again", async () => {
    await start();
    await pairPhone();
    expect((await login(0)).status).toBe(200);
    expect((await login(0)).status).toBe(200);
  });

  test("a login challenge is single use and expires after 5 minutes", async () => {
    await start();
    await pairPhone();
    const options = { challenge: await challengeFrom(await post("login/options", {})) };
    const response = fakeAssertion(options.challenge, TEST_ORIGIN, 1);
    expect((await post("login/verify", { response })).status).toBe(200);
    await expectError(await post("login/verify", { response }), 401, "UNAUTHORIZED");
    const late = { challenge: await challengeFrom(await post("login/options", {})) };
    server.advance(5 * 60_000);
    await expectError(
      await post("login/verify", { response: fakeAssertion(late.challenge, TEST_ORIGIN, 2) }),
      401,
      "UNAUTHORIZED",
    );
  });

  test("an unknown credential is 401", async () => {
    await start();
    await pairPhone();
    const options = { challenge: await challengeFrom(await post("login/options", {})) };
    const res = await post("login/verify", {
      response: fakeAssertion(options.challenge, TEST_ORIGIN, 1, "nope"),
    });
    await expectError(res, 401, "UNAUTHORIZED");
  });
});

describe("abuse", () => {
  test("100 login/options do not break a pair/verify in progress", async () => {
    await start();
    const pair = await pairing();
    const challenge = await challengeFrom(await post("pair/options", pair));
    const statuses = new Set<number>();
    for (let i = 0; i < 100; i++) statuses.add((await post("login/options", {})).status);
    expect(statuses).toEqual(new Set([200, 429]));
    const res = await post("pair/verify", { ...pair, response: fakeRegistration(challenge, TEST_ORIGIN) });
    expect(res.status).toBe(200);
  });

  test("login/options is rate limited globally, for a while", async () => {
    await start();
    await pairPhone();
    let calls = 0;
    while ((await post("login/options", {})).status === 200) calls++;
    expect(calls).toBeGreaterThanOrEqual(10);
    expect(calls).toBeLessThan(64);
    await expectError(await post("login/options", {}), 429, "RATE_LIMITED");
    server.advance(60_000);
    expect((await login(1)).status).toBe(200);
  });

  test("a refused passkey never tells the client why", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    await start({ webauthn: createWebauthn({ rpId: "127.0.0.1", origin: TEST_ORIGIN }) });
    const pair = await pairing();
    const options = await post("pair/options", pair);
    expect(await options.json()).toMatchObject({ authenticatorSelection: { userVerification: "required" } });
    const foreign = await auth.pairVerify(pair, "https://elsewhere.test");
    const text = await foreign.text();
    expect(foreign.status).toBe(401);
    expect(text).not.toContain("origin");
    expect(text).not.toContain("elsewhere");
    expect(spy.mock.calls.flat().join(" ")).toContain("origin");
    spy.mockRestore();
  });

  test("a replayed counter is refused without naming the counter", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    await start();
    await pairPhone();
    expect((await login(5)).status).toBe(200);
    const res = await login(2);
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("counter");
    spy.mockRestore();
  });
});
