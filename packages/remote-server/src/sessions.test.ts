import { afterEach, describe, expect, test } from "bun:test";
import { sealedSnapshot } from "./testing/fixtures";
import { cookieOf, expectError, phoneAuth } from "./testing/phone-auth";
import { connectPhoneEvents, startTestServer, TEST_ORIGIN, type TestServer } from "./testing/test-server";

const DAY_MS = 24 * 3_600_000;
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

async function start() {
  server = await startTestServer();
  auth = phoneAuth(server);
  return auth;
}

describe("sessions", () => {
  test("logout clears the session", async () => {
    await start();
    const { cookie } = await pairPhone();
    const res = await post("logout", {}, { cookie });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/^kibo_phone=; .*Max-Age=0/);
    await expectError(await session(cookie), 401, "UNAUTHORIZED");
  });

  test("session cookie is renewed when older than a day", async () => {
    await start();
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
    await start();
    const { cookie } = await pairPhone();
    expect(await (await session(cookie)).json()).toEqual({ ok: true, expiresAt: server.now() + 90 * DAY_MS });
    await expectError(await session("kibo_phone=forged"), 401, "UNAUTHORIZED");
  });

  test("pair, login and logout from another origin are 403", async () => {
    await start();
    const { cookie } = await pairPhone();
    for (const origin of [null, "https://elsewhere.test"])
      for (const path of ["pair/options", "pair/verify", "login/options", "login/verify", "logout"])
        await expectError(await post(path, {}, { cookie, origin }), 403, "FORBIDDEN");
    expect((await session(cookie)).status).toBe(200);
  });
});

async function upgradeHead(cookie: string): Promise<string> {
  const { port } = new URL(server.url);
  const request = [
    "GET /api/phone/events HTTP/1.1",
    `Host: 127.0.0.1:${port}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
    "Sec-WebSocket-Version: 13",
    `Origin: ${TEST_ORIGIN}`,
    `Cookie: ${cookie}`,
    "",
    "",
  ].join("\r\n");
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  let received = "";
  await Bun.connect({
    hostname: "127.0.0.1",
    port: Number(port),
    socket: {
      open: (socket) => {
        socket.write(request);
      },
      data: (socket, chunk) => {
        received += chunk.toString();
        const end = received.indexOf("\r\n\r\n");
        if (end === -1) return;
        socket.end();
        resolve(received.slice(0, end));
      },
      error: (_socket, error) => reject(error),
    },
  });
  return promise;
}

describe("event socket session", () => {
  test("the websocket upgrade renews a session older than a day", async () => {
    await start();
    const { cookie } = await pairPhone();
    const fresh = await upgradeHead(cookie);
    expect(fresh).toStartWith("HTTP/1.1 101");
    expect(fresh.toLowerCase()).not.toContain("set-cookie");
    server.advance(DAY_MS);
    const renewed = (await upgradeHead(cookie)).split("\r\n");
    expect(renewed[0]).toStartWith("HTTP/1.1 101");
    const setCookie = renewed.find((line) => line.toLowerCase().startsWith("set-cookie:")) ?? "";
    expect(setCookie).toContain(`${cookie};`);
    expect(setCookie).toContain(`Max-Age=${SESSION_MAX_AGE}`);
    server.advance(89 * DAY_MS + 1);
    expect((await session(cookie)).status).toBe(200);
  });
});

describe("revocation", () => {
  test("phone.revoke from the mac removes passkeys, sessions and snapshots and closes phone sockets with 4401", async () => {
    await start();
    const { cookie, mac } = await pairPhone();
    const phone = await connectPhoneEvents(server.url, cookie);
    mac.put({ type: "snapshot.put", sealed: sealedSnapshot("p1", "project", 1) });
    await phone.next("snapshot.changed");
    mac.put({ type: "phone.revoke" });
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
