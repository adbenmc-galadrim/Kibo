import { afterEach, describe, expect, test } from "bun:test";
import { sealedSnapshot } from "./testing/fixtures";
import { connectFakeMac, connectPhoneEvents, startTestServer, type TestServer } from "./testing/test-server";

let server: TestServer;
afterEach(() => server.stop());

const get = (path: string, cookie?: string) =>
  fetch(`${server.url}${path}`, cookie ? { headers: { cookie } } : {});

describe("phone routes", () => {
  test("/api/phone/* without session is 401", async () => {
    server = await startTestServer();
    const paths = [
      "/api/phone/snapshots?projectId=p1",
      "/api/phone/snapshot?projectId=p1&kind=project",
      "/api/phone/nope",
    ];
    for (const path of paths) {
      for (const cookie of [undefined, "kibo_phone=forged", "other=1"]) {
        const res = await get(path, cookie);
        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ ok: false, error: { code: "UNAUTHORIZED" } });
      }
    }
    const post = await fetch(`${server.url}/api/phone/request`, { method: "POST", body: "{}" });
    expect(post.status).toBe(401);
    await expect(connectPhoneEvents(server.url, "kibo_phone=forged")).rejects.toThrow();
  });

  test("an expired session is 401", async () => {
    server = await startTestServer();
    const cookie = server.phoneCookie();
    expect((await get("/api/phone/snapshots?projectId=p1", cookie)).status).toBe(200);
    server.advance(91 * 24 * 3_600_000);
    expect((await get("/api/phone/snapshots?projectId=p1", cookie)).status).toBe(401);
  });

  test("GET /api/phone/snapshots?projectId=p1 returns the latest Sealed per kind", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const cookie = server.phoneCookie();
    const phone = await connectPhoneEvents(server.url, cookie);
    const mac = await connectFakeMac(server.url, macToken);
    const latest = [sealedSnapshot("p1", "events", 1), sealedSnapshot("p1", "project", 2)];
    for (const sealed of [sealedSnapshot("p1", "project", 1), ...latest, sealedSnapshot("p2", "project", 1)])
      mac.put({ type: "snapshot.put", sealed });
    for (let i = 0; i < 4; i++) await phone.next("snapshot.changed");
    const res = await get("/api/phone/snapshots?projectId=p1", cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(latest);
    await Promise.all([phone.close(), mac.close()]);
  });

  test("GET /api/phone/snapshot-headers?projectId=p1 returns each kind and seq without the blocks", async () => {
    server = await startTestServer();
    const { macToken } = await server.registerMac();
    const cookie = server.phoneCookie();
    const phone = await connectPhoneEvents(server.url, cookie);
    const mac = await connectFakeMac(server.url, macToken);
    const latest = [sealedSnapshot("p1", "events", 1), sealedSnapshot("p1", "project", 2)];
    for (const sealed of [sealedSnapshot("p1", "project", 1), ...latest, sealedSnapshot("p2", "project", 1)])
      mac.put({ type: "snapshot.put", sealed });
    for (let i = 0; i < 4; i++) await phone.next("snapshot.changed");
    const res = await get("/api/phone/snapshot-headers?projectId=p1", cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(latest.map((s) => s.header));
    expect((await get("/api/phone/snapshot-headers", cookie)).status).toBe(400);
    expect((await get("/api/phone/snapshot-headers?projectId=p1")).status).toBe(401);
    await Promise.all([phone.close(), mac.close()]);
  });

  test("GET /api/phone/snapshot of a missing kind is 404 REMOTE_NOT_FOUND", async () => {
    server = await startTestServer();
    const res = await get("/api/phone/snapshot?projectId=p1&kind=project", server.phoneCookie());
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "REMOTE_NOT_FOUND" } });
  });

  test("a missing projectId or a bad kind is 400", async () => {
    server = await startTestServer();
    const cookie = server.phoneCookie();
    expect((await get("/api/phone/snapshots", cookie)).status).toBe(400);
    expect((await get("/api/phone/snapshot?projectId=p1&kind=notes", cookie)).status).toBe(400);
  });

  test("an unknown phone route is 404 for a signed-in phone", async () => {
    server = await startTestServer();
    expect((await get("/api/phone/nope", server.phoneCookie())).status).toBe(404);
  });
});
