import { afterEach, describe, expect, test } from "bun:test";
import { PAIR_TOKEN_TTL_MS } from "@kibo/remote/protocol";
import { z } from "zod";
import { fakeAssertion, fakeRegistration } from "./testing/fake-webauthn";
import { sealedSnapshot } from "./testing/fixtures";
import {
  connectFakeMac,
  connectPhoneEvents,
  type FakeMac,
  startTestServer,
  TEST_ORIGIN,
  type TestServer,
} from "./testing/test-server";

const DAY_MS = 24 * 3_600_000;
const SESSION_MAX_AGE = 90 * 24 * 3_600;
const Options = z.object({ challenge: z.string().min(1) });

let server: TestServer;
let mac: FakeMac | null = null;
afterEach(async () => {
  await mac?.close();
  mac = null;
  await server.stop();
});

type Call = { cookie?: string; origin?: string | null };

const post = (path: string, body: unknown, { cookie, origin = TEST_ORIGIN }: Call = {}) =>
  fetch(`${server.url}/api/phone/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin === null ? {} : { origin }),
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const session = (cookie: string) => fetch(`${server.url}/api/phone/session`, { headers: { cookie } });

const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

async function pairing() {
  const registered = await server.registerMac();
  mac = await connectFakeMac(server.url, registered.macToken);
  mac.put({ type: "pair.create" });
  const { pairToken } = await mac.next("pair.created");
  return { accountId: registered.accountId, pairToken };
}

async function pairPhone() {
  const pair = await pairing();
  const options = Options.parse(await (await post("pair/options", pair)).json());
  const res = await post("pair/verify", {
    ...pair,
    response: fakeRegistration(options.challenge, TEST_ORIGIN),
  });
  expect(res.status).toBe(200);
  return { ...pair, cookie: cookieOf(res) };
}

async function login(counter: number) {
  const options = Options.parse(await (await post("login/options", {})).json());
  return post("login/verify", { response: fakeAssertion(options.challenge, TEST_ORIGIN, counter) });
}

const expectError = async (res: Response, status: number, code: string) => {
  expect(res.status).toBe(status);
  expect(await res.json()).toMatchObject({ ok: false, error: { code } });
};

describe("pairing", () => {
  test("pair/options with an unknown or expired pairToken is 401 REMOTE_PAIRING_INVALID", async () => {
    server = await startTestServer();
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
    server = await startTestServer();
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
    server = await startTestServer();
    const pair = await pairing();
    const first = await post("pair/options", pair);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ authenticatorSelection: { residentKey: "required" } });
    expect((await post("pair/options", pair)).status).toBe(200);
  });

  test("pair/verify stores the passkey, consumes the token, opens a session (Set-Cookie kibo_phone HttpOnly Secure SameSite=Strict)", async () => {
    server = await startTestServer();
    const pair = await pairing();
    const options = Options.parse(await (await post("pair/options", pair)).json());
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

  test("a second pair/options with the same token is 401", async () => {
    server = await startTestServer();
    const { accountId, pairToken } = await pairPhone();
    await expectError(await post("pair/options", { accountId, pairToken }), 401, "REMOTE_PAIRING_INVALID");
  });

  test("a refused attestation keeps the token and opens no session", async () => {
    server = await startTestServer();
    const pair = await pairing();
    const options = Options.parse(await (await post("pair/options", pair)).json());
    const bad = await post("pair/verify", {
      ...pair,
      response: fakeRegistration(options.challenge, TEST_ORIGIN, "other-cred"),
    });
    await expectError(bad, 401, "UNAUTHORIZED");
    expect(bad.headers.get("set-cookie")).toBeNull();
    expect((await post("pair/options", pair)).status).toBe(200);
  });

  test("pair/verify needs a challenge issued by pair/options, once", async () => {
    server = await startTestServer();
    const pair = await pairing();
    const forged = await post("pair/verify", { ...pair, response: fakeRegistration("forged", TEST_ORIGIN) });
    await expectError(forged, 401, "REMOTE_PAIRING_INVALID");
    const login = Options.parse(await (await post("login/options", {})).json());
    const crossed = await post("pair/verify", {
      ...pair,
      response: fakeRegistration(login.challenge, TEST_ORIGIN),
    });
    await expectError(crossed, 401, "REMOTE_PAIRING_INVALID");
  });
});

describe("login", () => {
  test("login/options then login/verify opens a session and bumps the counter", async () => {
    server = await startTestServer();
    await pairPhone();
    const res = await login(3);
    expect(res.status).toBe(200);
    expect((await session(cookieOf(res))).status).toBe(200);
    await expectError(await login(3), 401, "UNAUTHORIZED");
    expect((await login(4)).status).toBe(200);
  });

  test("a counter lower than stored is refused", async () => {
    server = await startTestServer();
    await pairPhone();
    expect((await login(5)).status).toBe(200);
    const res = await login(2);
    await expectError(res, 401, "UNAUTHORIZED");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  test("an authenticator that always reports 0 can sign in again", async () => {
    server = await startTestServer();
    await pairPhone();
    expect((await login(0)).status).toBe(200);
    expect((await login(0)).status).toBe(200);
  });

  test("a login challenge is single use and expires after 5 minutes", async () => {
    server = await startTestServer();
    await pairPhone();
    const options = Options.parse(await (await post("login/options", {})).json());
    const response = fakeAssertion(options.challenge, TEST_ORIGIN, 1);
    expect((await post("login/verify", { response })).status).toBe(200);
    await expectError(await post("login/verify", { response }), 401, "UNAUTHORIZED");
    const late = Options.parse(await (await post("login/options", {})).json());
    server.advance(5 * 60_000);
    await expectError(
      await post("login/verify", { response: fakeAssertion(late.challenge, TEST_ORIGIN, 2) }),
      401,
      "UNAUTHORIZED",
    );
  });

  test("an unknown credential is 401", async () => {
    server = await startTestServer();
    await pairPhone();
    const options = Options.parse(await (await post("login/options", {})).json());
    const res = await post("login/verify", {
      response: fakeAssertion(options.challenge, TEST_ORIGIN, 1, "nope"),
    });
    await expectError(res, 401, "UNAUTHORIZED");
  });
});

describe("sessions", () => {
  test("logout clears the session", async () => {
    server = await startTestServer();
    const { cookie } = await pairPhone();
    const res = await post("logout", {}, { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^kibo_phone=; .*Max-Age=0/);
    await expectError(await session(cookie), 401, "UNAUTHORIZED");
  });

  test("session cookie is renewed when older than a day", async () => {
    server = await startTestServer();
    const { cookie } = await pairPhone();
    server.advance(DAY_MS - 1);
    expect((await session(cookie)).headers.get("set-cookie")).toBeNull();
    server.advance(1);
    const renewed = await session(cookie);
    expect(renewed.status).toBe(200);
    expect(cookieOf(renewed)).toBe(cookie);
    expect(renewed.headers.get("set-cookie") ?? "").toContain(`Max-Age=${SESSION_MAX_AGE}`);
    server.advance(89 * DAY_MS + 1);
    expect((await session(cookie)).status).toBe(200);
  });

  test("the session route reports the expiry and needs a cookie", async () => {
    server = await startTestServer();
    const { cookie } = await pairPhone();
    expect(await (await session(cookie)).json()).toEqual({ ok: true, expiresAt: server.now() + 90 * DAY_MS });
    await expectError(await session("kibo_phone=forged"), 401, "UNAUTHORIZED");
  });

  test("pair, login and logout from another origin are 403", async () => {
    server = await startTestServer();
    const { cookie } = await pairPhone();
    for (const origin of [null, "https://elsewhere.test"])
      for (const path of ["pair/options", "pair/verify", "login/options", "login/verify", "logout"])
        await expectError(await post(path, {}, { cookie, origin }), 403, "FORBIDDEN");
    expect((await session(cookie)).status).toBe(200);
  });
});

describe("revocation", () => {
  test("phone.revoke from the mac removes passkeys, sessions and snapshots and closes phone sockets with 4401", async () => {
    server = await startTestServer();
    const { cookie } = await pairPhone();
    const phone = await connectPhoneEvents(server.url, cookie);
    mac?.put({ type: "snapshot.put", sealed: sealedSnapshot("p1", "project", 1) });
    await phone.next("snapshot.changed");
    mac?.put({ type: "phone.revoke" });
    expect(await phone.closed).toBe(4401);
    await expectError(await session(cookie), 401, "UNAUTHORIZED");
    await expectError(await login(9), 401, "UNAUTHORIZED");
    const fresh = server.phoneCookie();
    const snapshots = await fetch(`${server.url}/api/phone/snapshots?projectId=p1`, {
      headers: { cookie: fresh },
    });
    expect(await snapshots.json()).toEqual([]);
  });
});
