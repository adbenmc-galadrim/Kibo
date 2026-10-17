import { afterAll, expect, test } from "bun:test";
import { connectSeedRpc, waitForDaemon } from "./seed-client";

const TOKEN = "t".repeat(64);
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/pair") {
      const body: unknown = await req.json();
      const ok = typeof body === "object" && body !== null && Reflect.get(body, "token") === TOKEN;
      return ok
        ? new Response(null, { status: 204, headers: { "set-cookie": "kibo_session=s1; HttpOnly" } })
        : new Response(null, { status: 401 });
    }
    if (url.pathname === "/api/rpc") {
      if (req.headers.get("cookie") !== "kibo_session=s1")
        return Response.json({ ok: false, error: "no session" });
      return Response.json({ ok: true, result: { user: "adam" } });
    }
    return new Response("ui");
  },
});
const base = `http://127.0.0.1:${server.port}`;
afterAll(() => server.stop(true));

test("the seed client pairs once and sends the session cookie", async () => {
  await waitForDaemon(base, 1_000);
  const rpc = await connectSeedRpc(base, TOKEN);
  expect(await rpc({ method: "getSession" })).toEqual({ user: "adam" });
});

test("a refused pairing stops the seed", async () => {
  await expect(connectSeedRpc(base, "x".repeat(64))).rejects.toThrow("pairing refused (401)");
});

test("a daemon that never answers is reported", async () => {
  await expect(waitForDaemon("http://127.0.0.1:9", 300)).rejects.toThrow("did not answer");
});
