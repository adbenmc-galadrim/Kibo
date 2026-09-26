import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SYNC_LIMITS } from "@kibo/schema";
import { generateKeyPair, KPKG_MAX_RAW_BYTES } from "@kibo/trust";
import { startSyncServer } from "./server";
import { startTestSyncServer, type TestSyncServer } from "./testing/start-test-server";

let t: TestSyncServer | null = null;
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await t?.stop();
  t = null;
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof Error && "code" in e ? String(e.code) : "no-code"),
  );

const errorOf = async (res: Response) =>
  ((await res.json()) as { error: { code: string; message: string } }).error;

test("refuses to listen on a non loopback address without TLS", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "kibo-sync-notls-"));
  const base = { dataDir, hostname: "192.0.2.10", port: 0, origin: "" };
  expect(await outcome(startSyncServer({ ...base, tls: null, behindProxy: false }))).toBe("TLS_REQUIRED");
  expect(await outcome(startSyncServer({ ...base, tls: null, behindProxy: true }))).toBe("TLS_REQUIRED");
  rmSync(dataDir, { recursive: true, force: true });
});

test("joins with an invite code over HTTPS and refuses a reused code with 403", async () => {
  const s = await startTestSyncServer();
  t = s;
  const code = await s.inviteAccount("Adam");
  const post = async () => {
    const keys = await generateKeyPair();
    return fetch(`${s.httpsUrl}/v1/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, publicKey: keys.publicKey, deviceName: "Mac" }),
      tls: { ca: s.caPem },
    });
  };
  const first = await post();
  expect(first.status).toBe(200);
  expect(((await first.json()) as { result: { name: string } }).result.name).toBe("Adam");
  const second = await post();
  expect(second.status).toBe(403);
  expect(await errorOf(second)).toEqual({
    code: "INVITE_INVALID",
    message: "invite code is invalid, expired or already used",
  });
});

test("a join body is bounded and a malformed one leaks no parser detail", async () => {
  const s = await startTestSyncServer();
  t = s;
  const post = (body: string) =>
    fetch(`${s.httpsUrl}/v1/join`, { method: "POST", body, tls: { ca: s.caPem } });
  const big = await post("x".repeat(64 * 1024));
  expect(big.status).toBe(413);
  expect((await errorOf(big)).code).toBe("TOO_LARGE");
  const broken = await post("{");
  expect(broken.status).toBe(400);
  expect(await errorOf(broken)).toEqual({ code: "INVALID_INPUT", message: "invalid request" });
});

test("rejects a plain HTTP client and unknown paths", async () => {
  const s = await startTestSyncServer();
  t = s;
  expect((await fetch(`${s.httpsUrl}/nope`, { tls: { ca: s.caPem } })).status).toBe(404);
  const plain = await fetch(`http://127.0.0.1:${s.server.port}/v1/join`).then(
    () => "answered",
    () => "refused",
  );
  expect(plain).toBe("refused");
});

test("a package as large as the kpkg bound reaches the market route", async () => {
  const s = await startTestSyncServer({ market: { id: "equipe", name: "Équipe" } });
  t = s;
  const res = await fetch(`${s.httpsUrl}/v1/market/packages`, {
    method: "POST",
    body: new Uint8Array(KPKG_MAX_RAW_BYTES),
    tls: { ca: s.caPem },
  });
  expect(res.status).toBe(401);
  expect((await errorOf(res)).code).toBe("UNAUTHORIZED");
  const index = await fetch(`${s.httpsUrl}/market/index.json`, { tls: { ca: s.caPem } });
  expect(index.status).toBe(200);
});

test("behind a proxy, the address is the one the proxy appended", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "kibo-sync-proxy-"));
  const server = await startSyncServer({
    dataDir,
    hostname: "127.0.0.1",
    port: 0,
    origin: "wss://sync.kibo.test",
    tls: null,
    behindProxy: true,
  });
  cleanups.push(async () => {
    await server.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });
  const { publicKey } = await generateKeyPair();
  const postJoin = (forwardedFor: string) =>
    fetch(`${server.url}/v1/join`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": forwardedFor },
      body: JSON.stringify({ code: "AAAABBBB", publicKey, deviceName: "Mac" }),
    });
  for (let i = 0; i < SYNC_LIMITS.authFailuresPerMinute; i++) await postJoin("198.51.100.1, 203.0.113.5");
  expect((await postJoin("203.0.113.5")).status).toBe(429);
  expect((await postJoin("203.0.113.5, 198.51.100.2")).status).not.toBe(429);
});
