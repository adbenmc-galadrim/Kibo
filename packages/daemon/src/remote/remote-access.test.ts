import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { SessionInfo } from "@kibo/schema";
import {
  certOf,
  enableSelfSigned,
  localPair,
  localPost,
  type RemoteFixture,
  remoteCookie,
  remotePair,
  remotePost,
  remoteUrl,
  startRemoteFixture,
  stopRemoteFixture,
  TOKEN,
} from "./remote.test-helper";

let f: RemoteFixture;
beforeEach(() => {
  f = startRemoteFixture();
});
afterEach(() => stopRemoteFixture(f));

describe("remote listener", () => {
  test("pairs by code over HTTPS with a Secure cookie and a remote session", async () => {
    const status = await enableSelfSigned(f);
    expect(status).toMatchObject({
      enabled: true,
      address: "127.0.0.1",
      port: f.port,
      url: remoteUrl(f),
      tls: "self-signed",
    });
    expect(status.fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    const cookie = await remotePair(f);
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=2592000");
    const list = await remotePost(
      f,
      "/api/rpc",
      { method: "listSessions" },
      { cookie: cookie.split(";")[0] ?? "" },
    );
    const body = (await list.json()) as { result: SessionInfo[] };
    expect(body.result.find((s) => s.current)?.remote).toBe(true);
  });

  test("pairing by code also works locally, without the Secure flag", async () => {
    const res = await localPost(f, "/api/pair-code", { code: f.codes.create().code });
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).not.toContain("Secure");
  });

  test("a wrong code is refused, and too many attempts are rate limited", async () => {
    await enableSelfSigned(f);
    f.codes.create();
    for (let i = 0; i < 4; i++) {
      expect((await remotePost(f, "/api/pair-code", { code: "ZZZZZZ" })).status).toBe(401);
    }
    const limited = await remotePost(f, "/api/pair-code", { code: "ZZZZZZ" });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
  });

  test("a foreign Host or Origin is refused", async () => {
    await enableSelfSigned(f);
    const cookie = await remoteCookie(f);
    const list = { method: "listProjects" };
    expect((await remotePost(f, "/api/rpc", list, { cookie })).status).toBe(200);
    expect((await remotePost(f, "/api/rpc", list, { cookie, host: "evil.test" })).status).toBe(403);
    expect((await remotePost(f, "/api/rpc", list, { cookie, origin: f.server.url })).status).toBe(403);
  });

  test("token pairing is refused", async () => {
    await enableSelfSigned(f);
    expect((await remotePost(f, "/api/pair", { token: TOKEN })).status).toBe(403);
  });

  test("agent hooks are refused", async () => {
    await enableSelfSigned(f);
    expect((await remotePost(f, `/hooks/${crypto.randomUUID()}`, {})).status).toBe(404);
  });

  test("sensitive RPCs are refused from a remote session", async () => {
    await enableSelfSigned(f);
    const cookie = await remoteCookie(f);
    for (const body of [
      { method: "createPairingCode" },
      { method: "disableRemoteAccess" },
      { method: "enableRemoteAccess", address: "127.0.0.1", port: f.port, tls: { kind: "self-signed" } },
    ]) {
      const res = await remotePost(f, "/api/rpc", body, { cookie });
      expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    const status = await remotePost(f, "/api/rpc", { method: "getRemoteAccess" }, { cookie });
    expect(await status.json()).toMatchObject({ ok: true, result: { enabled: true } });
  });

  test("a local session replayed on the remote listener counts as remote", async () => {
    await enableSelfSigned(f);
    const cookie = await localPair(f);
    const res = await remotePost(f, "/api/rpc", { method: "createPairingCode" }, { cookie });
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  test("streams the same events over wss", async () => {
    await enableSelfSigned(f);
    const ws = new WebSocket(`wss://127.0.0.1:${f.port}/api/events`, {
      headers: { origin: remoteUrl(f), cookie: await remoteCookie(f) },
      tls: { ca: certOf(f) },
    });
    await new Promise((r) => {
      ws.onopen = r;
    });
    const message = new Promise<unknown>((r) => {
      ws.onmessage = (e) => r(JSON.parse(String(e.data)));
    });
    const admin = await localPair(f);
    await localPair(f);
    const listed = await localPost(f, "/api/rpc", { method: "listSessions" }, admin);
    const other = ((await listed.json()) as { result: SessionInfo[] }).result.find(
      (s) => !s.current && !s.remote,
    );
    expect((await localPost(f, "/api/rpc", { method: "revokeSession", id: other?.id }, admin)).status).toBe(
      200,
    );
    expect(await message).toEqual({ type: "sessions.changed" });
    ws.close();
  });

  test("refuses to start without TLS material", () => {
    expect(() =>
      f.server.listenRemote({ hostname: "127.0.0.1", port: f.port, tls: { cert: "", key: "" } }),
    ).toThrow("TLS_REQUIRED");
  });
});
