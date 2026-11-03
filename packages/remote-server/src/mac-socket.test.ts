import { afterEach, describe, expect, test } from "bun:test";
import { sealedSnapshot } from "./testing/fixtures";
import { connectFakeMac, connectPhoneEvents, startTestServer, type TestServer } from "./testing/test-server";

const OLD_TOKEN = "o".repeat(43);
const NEW_TOKEN = "n".repeat(43);

let server: TestServer;
afterEach(() => server.stop());

const register = (setupCode: string, macToken: string) =>
  fetch(`${server.url}/api/mac/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ setupCode, macToken }),
  });

const macStatus = (macToken: string | null) =>
  fetch(`${server.url}/api/mac`, macToken ? { headers: { authorization: `Bearer ${macToken}` } } : {}).then(
    (r) => r.status,
  );

describe("mac registration", () => {
  test("register with a wrong setup code is 403", async () => {
    server = await startTestServer();
    const res = await register("wrong", "token-1");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await macStatus("token-1")).toBe(401);
  });

  test("register refuses a mac token shorter than 256 bits of base64url", async () => {
    server = await startTestServer();
    for (const macToken of ["", "a".repeat(42), `${"a".repeat(42)}=`, `${"a".repeat(42)}+`]) {
      const res = await register(server.setupCode, macToken);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    }
    expect((await register(server.setupCode, "a".repeat(43))).status).toBe(200);
  });

  test("register twice with the right code replaces the mac token (old token gets 401 on /api/mac)", async () => {
    server = await startTestServer();
    const first = await server.registerMac(OLD_TOKEN);
    const second = await server.registerMac(NEW_TOKEN);
    expect(second.accountId).toBe(first.accountId);
    expect(await macStatus(OLD_TOKEN)).toBe(401);
    expect(await macStatus(NEW_TOKEN)).toBe(426);
    await expect(connectFakeMac(server.url, OLD_TOKEN)).rejects.toThrow();
    const mac = await connectFakeMac(server.url, NEW_TOKEN);
    await mac.close();
  });

  test("registering again closes the connected mac and revokes the phone", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const mac = await connectFakeMac(server.url, macToken);
    const cookie = server.phoneCookie();
    await server.registerMac();
    expect(await mac.closed).toBe(4401);
    const res = await fetch(`${server.url}/api/phone/snapshots?projectId=p1`, { headers: { cookie } });
    expect(res.status).toBe(401);
  });

  test("WS /api/mac without bearer is 401", async () => {
    server = await startTestServer();
    await server.registerMac();
    expect(await macStatus(null)).toBe(401);
    await expect(connectFakeMac(server.url, "")).rejects.toThrow();
  });
});

describe("mac socket", () => {
  test("snapshot.put is stored and phones get snapshot.changed", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const cookie = server.phoneCookie();
    const phone = await connectPhoneEvents(server.url, cookie);
    const mac = await connectFakeMac(server.url, macToken);
    const block = sealedSnapshot("p1", "project", 3);
    mac.put({ type: "snapshot.put", sealed: block });
    expect(await phone.next("snapshot.changed")).toEqual({
      type: "snapshot.changed",
      projectId: "p1",
      kind: "project",
      seq: 3,
    });
    const res = await fetch(`${server.url}/api/phone/snapshot?projectId=p1&kind=project`, {
      headers: { cookie },
    });
    expect(await res.json()).toEqual(block);
    await Promise.all([phone.close(), mac.close()]);
  });

  test("a snapshot over the limit is answered with REMOTE_TOO_LARGE and nothing changes", async () => {
    server = await startTestServer({ maxTotalBytes: 40 });
    const { macToken } = await server.registerMac();
    const mac = await connectFakeMac(server.url, macToken);
    mac.put({ type: "snapshot.put", sealed: sealedSnapshot("p1", "project", 1) });
    expect(await mac.next("error")).toMatchObject({ type: "error", code: "REMOTE_TOO_LARGE" });
    await mac.close();
  });

  test("snapshot.remove and project.remove tell the phones what left", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const cookie = server.phoneCookie();
    const mac = await connectFakeMac(server.url, macToken);
    const phone = await connectPhoneEvents(server.url, cookie);
    for (const kind of ["project", "events", "ci"])
      mac.put({ type: "snapshot.put", sealed: sealedSnapshot("p1", kind, 1) });
    for (let i = 0; i < 3; i++) await phone.next("snapshot.changed");
    mac.put({ type: "snapshot.remove", projectId: "p1", kind: "ci" });
    expect(await phone.next("snapshot.removed")).toEqual({
      type: "snapshot.removed",
      projectId: "p1",
      kind: "ci",
    });
    mac.put({ type: "project.remove", projectId: "p1" });
    const removed = [await phone.next("snapshot.removed"), await phone.next("snapshot.removed")];
    expect(removed.map((e) => e.kind).sort()).toEqual(["events", "project"]);
    const res = await fetch(`${server.url}/api/phone/snapshots?projectId=p1`, { headers: { cookie } });
    expect(await res.json()).toEqual([]);
    await Promise.all([phone.close(), mac.close()]);
  });

  test("pair.create answers pair.created with a fresh token", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const mac = await connectFakeMac(server.url, macToken);
    mac.put({ type: "pair.create" });
    const created = await mac.next("pair.created");
    expect(created.pairToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(created.expiresAt).toBe(server.now() + 600_000);
    await mac.close();
  });

  test("ping is answered with pong", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const mac = await connectFakeMac(server.url, macToken);
    mac.put({ type: "ping", at: 1 });
    expect(await mac.next("pong")).toEqual({ type: "pong", at: server.now() });
    await mac.close();
  });

  test("a malformed message is answered with INVALID_INPUT", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const mac = await connectFakeMac(server.url, macToken);
    mac.send({ type: "snapshot.put", sealed: { header: {} } });
    expect(await mac.next("error")).toMatchObject({ code: "INVALID_INPUT" });
    await mac.close();
  });

  test("a second mac connection closes the first", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const first = await connectFakeMac(server.url, macToken);
    const second = await connectFakeMac(server.url, macToken);
    expect(await first.closed).toBe(4409);
    second.put({ type: "ping", at: 1 });
    await second.next("pong");
    await second.close();
  });

  test("mac.presence goes offline on close and online on open, with lastSeenAt", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const phone = await connectPhoneEvents(server.url, server.phoneCookie());
    expect(await phone.next("mac.presence")).toEqual({
      type: "mac.presence",
      online: false,
      lastSeenAt: null,
    });
    const openedAt = server.now();
    const mac = await connectFakeMac(server.url, macToken);
    expect(await phone.next("mac.presence")).toEqual({
      type: "mac.presence",
      online: true,
      lastSeenAt: openedAt,
    });
    server.advance(5_000);
    mac.put({ type: "ping", at: 1 });
    await mac.next("pong");
    server.advance(1_000);
    await mac.close();
    expect(await phone.next("mac.presence")).toEqual({
      type: "mac.presence",
      online: false,
      lastSeenAt: openedAt + 6_000,
    });
    const late = await connectPhoneEvents(server.url, server.phoneCookie());
    expect(await late.next("mac.presence")).toEqual({
      type: "mac.presence",
      online: false,
      lastSeenAt: openedAt + 6_000,
    });
    await Promise.all([phone.close(), late.close()]);
  });
});
