import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server";
import { createService } from "../service";
import { openStore, type Store } from "../store";
import { openSessionStore, SESSION_TTL_MS, type SessionStore } from "./session-store";

const TOKEN = "a".repeat(64);
let home: string;
let store: Store;
let clock: number;
let server: ReturnType<typeof startServer>;

const boot = (sessions: SessionStore = openSessionStore(store.db)) =>
  startServer({
    service: createService(store, { user: "adam" }),
    sessions,
    token: TOKEN,
    port: 0,
    uiDir: null,
    now: () => clock,
  });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-cookie-"));
  store = openStore(home);
  clock = 1_000_000;
  server = boot();
});
afterEach(() => {
  server.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${server.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: server.url, ...headers },
    body: JSON.stringify(body),
  });
const pairCookie = async () => (await post("/api/pair", { token: TOKEN })).headers.get("set-cookie") ?? "";
const idOf = (cookie: string) => cookie.split(";")[0] ?? "";

test("the pairing cookie lasts as long as the session and is not Secure on 127.0.0.1", async () => {
  const cookie = await pairCookie();
  expect(cookie).toMatch(/^kibo_session=[0-9a-f]{64}; /);
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Strict");
  expect(cookie).toContain("Path=/");
  expect(cookie).toContain(`Max-Age=${SESSION_TTL_MS / 1000}`);
  expect(cookie).not.toContain("Secure");
});

test("the cookie is sent again when the session slides", async () => {
  const cookie = idOf(await pairCookie());
  const quiet = await post("/api/rpc", { method: "listProjects" }, { cookie });
  expect(quiet.headers.get("set-cookie")).toBeNull();
  clock += 61_000;
  const renewed = await post("/api/rpc", { method: "listProjects" }, { cookie });
  expect(renewed.headers.get("set-cookie")).toBe(
    `${cookie}; Max-Age=${SESSION_TTL_MS / 1000}; HttpOnly; SameSite=Strict; Path=/`,
  );
});

test("stale sessions are purged when the server starts", async () => {
  const sessions = openSessionStore(store.db);
  const gone = sessions.create({ deviceName: "Chrome · macOS", remote: true }, 0);
  const kept = sessions.create({ deviceName: "Chrome · macOS", remote: false }, clock);
  sessions.revoke(kept.hash, clock);
  const alive = sessions.create({ deviceName: "Application Kibo", remote: false }, clock);
  server.stop();
  clock += SESSION_TTL_MS - 1;
  server = boot();
  const rows = store.db.query<{ idHash: string }, []>("SELECT idHash FROM remote_sessions").all();
  expect(rows.map((r) => r.idHash)).toEqual([alive.hash]);
  expect(gone.hash).not.toBe(alive.hash);
});

test("a websocket whose session was revoked before open is closed", async () => {
  const real = openSessionStore(store.db);
  server.stop();
  server = boot({ ...real, isActive: () => false });
  const cookie = idOf(await pairCookie());
  const ws = new WebSocket(`${server.url.replace("http", "ws")}/api/events`, {
    headers: { origin: server.url, cookie },
  });
  const code = await new Promise<number>((r) => {
    ws.onclose = (e) => r(e.code);
  });
  expect(code).toBe(4401);
});
