import { afterEach, describe, expect, test } from "bun:test";
import { EMBED_ATTRIBUTES } from "@kibo/schema";
import { createEmbedService } from "../embed/embed-service";
import { sandboxHeaders, startSandboxServer } from "./sandbox-server";

const TARGET = "https://itch.io/embed-upload/1?color=333";
const servers: { stop(): void }[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.stop();
});

function relayServer(withRelay = true) {
  let now = 0;
  let origin: string | null = null;
  const embeds = createEmbedService({
    now: () => now,
    sandboxOrigin: () => origin,
    uiOrigins: () => ["http://127.0.0.1:4317", "http://localhost:4317"],
    devOrigins: ["http://localhost:5173"],
    aliases: new Map(),
  });
  const s = startSandboxServer({
    port: 0,
    uiPort: 4317,
    assets: () => null,
    ...(withRelay && { embeds }),
  });
  servers.push(s);
  origin = s.url;
  const pathOf = (title = "itch.io", instanceId = "w1") =>
    new URL(embeds.open(instanceId, "game", TARGET, title).url).pathname;
  const advance = (ms: number) => {
    now += ms;
  };
  return { s, pathOf, advance };
}
const request = (s: { port: number }, path: string, method = "GET", host = `127.0.0.1:${s.port}`) =>
  fetch(`http://127.0.0.1:${s.port}${path}`, { method, headers: { host } });

describe("relay route", () => {
  test("GET /e/<token> serves the locked relay page", async () => {
    const { s, pathOf } = relayServer();
    const res = await request(s, pathOf());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; frame-src https://itch.io; " +
        "frame-ancestors http://127.0.0.1:4317 http://localhost:4317 'self' http://localhost:5173; " +
        "base-uri 'none'; form-action 'none'",
    );
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("set-cookie")).toBeNull();
    const page = await res.text();
    expect(page.match(/<iframe/g)).toHaveLength(1);
    expect(page).toContain(`src="${TARGET}"`);
    expect(page).toContain(`sandbox="${EMBED_ATTRIBUTES.game.sandbox}"`);
    expect(page).toContain('referrerpolicy="no-referrer"');
    expect(page.toLowerCase()).not.toContain("<script");
  });

  test("a hostile title stays inside its attribute", async () => {
    const { s, pathOf } = relayServer();
    const page = await (await request(s, pathOf('"><script>'))).text();
    expect(page.toLowerCase()).not.toContain("<script");
    expect(page).toContain('title="&quot;&gt;&lt;script&gt;"');
  });

  test("the same token answers twice before it expires, then is a 404", async () => {
    const { s, pathOf, advance } = relayServer();
    const path = pathOf();
    expect((await request(s, path)).status).toBe(200);
    expect((await request(s, path)).status).toBe(200);
    advance(15 * 60_000);
    expect((await request(s, path)).status).toBe(404);
  });

  test("the seventeenth open of an instance retires its first token", async () => {
    const { s, pathOf } = relayServer();
    const first = pathOf();
    for (let i = 0; i < 15; i++) pathOf();
    expect((await request(s, first)).status).toBe(200);
    pathOf();
    expect((await request(s, first)).status).toBe(404);
  });

  test("unknown or malformed tokens are 404, other methods 405, a foreign host 403", async () => {
    const { s, pathOf } = relayServer();
    const path = pathOf();
    for (const bad of [`/e/${"0".repeat(64)}`, "/e/short", `${path}/x`, `/e/${"A".repeat(64)}`])
      expect((await request(s, bad)).status).toBe(404);
    for (const method of ["HEAD", "POST", "PUT", "DELETE"])
      expect((await request(s, path, method)).status).toBe(405);
    expect((await request(s, path, "GET", "evil.test")).status).toBe(403);
  });

  test("without a relay every token is a 404", async () => {
    const { s, pathOf } = relayServer(false);
    expect((await request(s, pathOf())).status).toBe(404);
  });
});

describe("csp of sandboxed components", () => {
  test("frame-src 'self' only with design or embed", () => {
    const csp = (caps: Parameters<typeof sandboxHeaders>[2]) =>
      sandboxHeaders(4317, [], caps)["content-security-policy"];
    expect(csp(["design"])).toContain("connect-src 'none'; frame-src 'self'; frame-ancestors");
    expect(csp(["embed"])).toContain("frame-src 'self'");
    expect(csp(["embed", "design", "assets"])).toContain("connect-src 'self'; frame-src 'self';");
    expect(csp(["webgl"])).not.toContain("frame-src");
    expect(csp([])).not.toContain("frame-src");
  });
});
