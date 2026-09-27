import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { connectLocalDaemon, readDaemonAccess } from "./daemon-client";

const TOKEN = "t".repeat(40);
const SESSION = "a".repeat(64);
type Seen = { path: string; origin: string | null; cookie: string | null; body: unknown };

function fakeDaemon(reply: (body: Record<string, unknown>) => unknown) {
  const seen: Seen[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const body = (await req.json()) as Record<string, unknown>;
      seen.push({
        path: url.pathname,
        origin: req.headers.get("origin"),
        cookie: req.headers.get("cookie"),
        body,
      });
      if (url.pathname === "/api/pair") {
        if (body.token !== TOKEN) return new Response(null, { status: 401 });
        return new Response(null, { status: 204, headers: { "set-cookie": "kibo_session=s1; HttpOnly" } });
      }
      return Response.json(reply(body));
    },
  });
  return { port: server.port ?? 0, seen, stop: () => server.stop(true) };
}

let stops: (() => void)[] = [];
afterEach(() => {
  for (const s of stops) s();
  stops = [];
});

describe("connectLocalDaemon", () => {
  test("pairs with the token then sends rpc with the session cookie and origin", async () => {
    const d = fakeDaemon(() => ({ ok: true, result: [] }));
    stops.push(d.stop);
    const client = await connectLocalDaemon({ port: d.port, token: TOKEN });
    expect(await client.rpc({ method: "listProjects" })).toEqual([]);
    const base = `http://127.0.0.1:${d.port}`;
    expect(d.seen.map((s) => s.path)).toEqual(["/api/pair", "/api/rpc"]);
    expect(d.seen[0]?.origin).toBe(base);
    expect(d.seen[1]).toMatchObject({ origin: base, cookie: "kibo_session=s1" });
  });

  test("refuses a wrong token", async () => {
    const d = fakeDaemon(() => ({ ok: true, result: null }));
    stops.push(d.stop);
    expect(connectLocalDaemon({ port: d.port, token: "wrong" })).rejects.toThrow("pairing refused");
  });

  test("turns a refused rpc into a KiboError with the daemon code", async () => {
    const d = fakeDaemon(() => ({ ok: false, error: { code: "NOT_FOUND", message: "no such project" } }));
    stops.push(d.stop);
    const client = await connectLocalDaemon({ port: d.port, token: TOKEN });
    const error = await client.rpc({ method: "getProject", projectId: "p" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(KiboError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });

  test("validates a request before sending it", async () => {
    const d = fakeDaemon(() => ({ ok: true, result: null }));
    stops.push(d.stop);
    const client = await connectLocalDaemon({ port: d.port, token: TOKEN });
    const invalid = { method: "getProject", projectId: "" } as const;
    expect(client.rpc(invalid)).rejects.toThrow();
    expect(d.seen.map((s) => s.path)).toEqual(["/api/pair"]);
  });

  test("close revokes only its own session", async () => {
    const d = fakeDaemon((body) =>
      body.method === "listSessions"
        ? {
            ok: true,
            result: [
              { id: "b".repeat(64), current: false },
              { id: SESSION, current: true },
            ],
          }
        : { ok: true, result: null },
    );
    stops.push(d.stop);
    const client = await connectLocalDaemon({ port: d.port, token: TOKEN });
    await client.close();
    expect(d.seen.at(-1)?.body).toEqual({ method: "revokeSession", id: SESSION });
  });
});

describe("readDaemonAccess", () => {
  test("reads the port from daemon.json and the trimmed token", () => {
    const home = mkdtempSync(join(tmpdir(), "kibo-dogfood-"));
    try {
      writeFileSync(join(home, "daemon.json"), JSON.stringify({ port: 4461, sandboxPort: 4462, pid: 1 }));
      writeFileSync(join(home, "token"), `${TOKEN}\n`);
      expect(readDaemonAccess(home)).toEqual({ port: 4461, token: TOKEN });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("says the daemon is not running when daemon.json is missing", () => {
    const home = mkdtempSync(join(tmpdir(), "kibo-dogfood-"));
    try {
      expect(() => readDaemonAccess(home)).toThrow("daemon not running");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
