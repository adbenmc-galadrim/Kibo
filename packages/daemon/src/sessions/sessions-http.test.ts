import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionInfo } from "@kibo/schema";
import { startServer } from "../server";
import { createService } from "../service";
import { openStore, type Store } from "../store";
import { openSessionStore, SESSION_TTL_MS } from "./session-store";

const TOKEN = "a".repeat(64);
let home: string;
let store: Store;
let clock: number;
let server: ReturnType<typeof startServer>;

const boot = () =>
  startServer({
    service: createService(store, { user: "adam" }),
    sessions: openSessionStore(store.db),
    token: TOKEN,
    port: 0,
    uiDir: null,
    now: () => clock,
  });

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-sess-"));
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

async function pair(userAgent = "Mozilla/5.0 (Macintosh) Chrome/129.0 Safari/537.36"): Promise<string> {
  const res = await post("/api/pair", { token: TOKEN }, { "user-agent": userAgent });
  expect(res.status).toBe(204);
  return res.headers.get("set-cookie")?.split(";")[0] ?? "";
}
const rpc = (body: unknown, cookie: string) => post("/api/rpc", body, { cookie });

async function openEvents(cookie: string): Promise<WebSocket> {
  const ws = new WebSocket(`${server.url.replace("http", "ws")}/api/events`, {
    headers: { origin: server.url, cookie },
  });
  await new Promise((r) => {
    ws.onopen = r;
  });
  return ws;
}

test("without a session store the server still pairs in memory", async () => {
  server.stop();
  server = startServer({
    service: createService(store, { user: "adam" }),
    token: TOKEN,
    port: 0,
    uiDir: null,
  });
  const cookie = await pair();
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(200);
});

test("a session survives a daemon restart", async () => {
  const cookie = await pair();
  server.stop();
  server = boot();
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(200);
});

test("a session expires after 30 days without activity", async () => {
  const cookie = await pair();
  clock += SESSION_TTL_MS;
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(401);
});

test("an active session keeps sliding", async () => {
  const cookie = await pair();
  clock += SESSION_TTL_MS - 60_000;
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(200);
  clock += SESSION_TTL_MS - 60_000;
  expect((await rpc({ method: "listProjects" }, cookie)).status).toBe(200);
});

test("listSessions marks the calling session as current", async () => {
  const mine = await pair();
  await pair("Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0");
  const res = (await (await rpc({ method: "listSessions" }, mine)).json()) as {
    ok: true;
    result: SessionInfo[];
  };
  expect(res.result).toHaveLength(2);
  expect(res.result.filter((s) => s.current).map((s) => s.deviceName)).toEqual(["Chrome · macOS"]);
  expect(res.result.map((s) => s.deviceName).sort()).toEqual(["Chrome · macOS", "Firefox · Linux"]);
  expect(res.result.every((s) => s.remote === false)).toBe(true);
});

test("revoking a session refuses its next request and closes its websocket", async () => {
  const admin = await pair();
  const victim = await pair("Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0");
  const ws = await openEvents(victim);
  const watcher = await openEvents(admin);
  const changed = new Promise<unknown>((r) => {
    watcher.onmessage = (e) => r(JSON.parse(String(e.data)));
  });
  const closed = new Promise<number>((r) => {
    ws.onclose = (e) => r(e.code);
  });
  const list = (await (await rpc({ method: "listSessions" }, admin)).json()) as { result: SessionInfo[] };
  const target = list.result.find((s) => !s.current);
  expect(target).toBeDefined();
  const revoked = await rpc({ method: "revokeSession", id: target?.id }, admin);
  expect(await revoked.json()).toEqual({ ok: true, result: null });
  expect(await closed).toBe(4401);
  expect(await changed).toEqual({ type: "sessions.changed" });
  watcher.close();
  expect((await rpc({ method: "listProjects" }, victim)).status).toBe(401);
  expect((await rpc({ method: "listProjects" }, admin)).status).toBe(200);
});

test("the database never holds a raw session id", async () => {
  const cookie = await pair();
  const id = cookie.split("=")[1] ?? "";
  expect(id).toMatch(/^[0-9a-f]{64}$/);
  expect(Buffer.from(store.db.serialize()).includes(Buffer.from(id))).toBe(false);
});
