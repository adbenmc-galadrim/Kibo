import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { idleSeconds, startRemoteServer } from "./server";
import { connectFakeMac, startTestServer, type TestServer } from "./testing/test-server";

let staticDir = "";
beforeAll(() => {
  staticDir = mkdtempSync(join(tmpdir(), "kibo-remote-static-"));
  writeFileSync(join(staticDir, "index.html"), "<p>kibo phone</p>");
  mkdirSync(join(staticDir, "assets"));
  writeFileSync(join(staticDir, "assets", "app.js"), "console.log(1)");
});

let stop: () => Promise<void> = async () => {};
afterEach(() => stop());

describe("remote server", () => {
  test("the idle timeout outlasts the relay timeout, within the 255 s Bun allows", () => {
    expect(idleSeconds(30_000)).toBe(35);
    expect(idleSeconds(12_000)).toBe(17);
    expect(idleSeconds(50)).toBe(6);
    expect(idleSeconds(600_000)).toBe(255);
  });

  test("startRemoteServer listens and reports health", async () => {
    const server = await startRemoteServer({
      port: 0,
      db: ":memory:",
      origin: "http://127.0.0.1",
      rpId: "127.0.0.1",
      setupCode: "a-setup-code-long-enough",
      staticDir: null,
    });
    stop = server.stop;
    expect(server.port).toBeGreaterThan(0);
    expect(server.url).toBe(`http://127.0.0.1:${server.port}`);
    expect(await (await fetch(`${server.url}/api/health`)).json()).toEqual({ ok: true, mac: "offline" });
  });

  test("GET /api/health is { ok: true, mac: online|offline }", async () => {
    const test: TestServer = await startTestServer();
    stop = test.stop;
    const { macToken } = await test.registerMac();
    const health = async () => (await fetch(`${test.url}/api/health`)).json();
    expect(await health()).toEqual({ ok: true, mac: "offline" });
    const mac = await connectFakeMac(test.url, macToken);
    expect(await health()).toEqual({ ok: true, mac: "online" });
    await mac.close();
    expect(await health()).toEqual({ ok: true, mac: "offline" });
  });

  test("GET /unknown returns index.html when staticDir is set", async () => {
    const test = await startTestServer({ staticDir });
    stop = test.stop;
    const page = await fetch(`${test.url}/graph/p1`);
    expect(page.status).toBe(200);
    expect(await page.text()).toMatch(/^<meta property="csp-nonce" content="[^"]+"><p>kibo phone<\/p>$/);
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
    expect(page.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(await (await fetch(`${test.url}/assets/app.js`)).text()).toBe("console.log(1)");
    expect((await fetch(`${test.url}/..%2F..%2Fetc%2Fpasswd`)).status).toBe(403);
  });

  test("GET /api/unknown is 404 even with staticDir", async () => {
    const test = await startTestServer({ staticDir });
    stop = test.stop;
    const res = await fetch(`${test.url}/api/unknown`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  test("without staticDir a page is 404", async () => {
    const test = await startTestServer();
    stop = test.stop;
    expect((await fetch(`${test.url}/`)).status).toBe(404);
  });
});
