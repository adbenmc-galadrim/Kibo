import { afterEach, describe, expect, test } from "bun:test";
import { ComponentManifest } from "@kibo/schema";
import { storedVersion } from "./fake-store.test-helper";
import { type AssetLookup, startSandboxServer } from "./sandbox-server";

const H = "c".repeat(64);
const OTHER = "d".repeat(64);
const stored = storedVersion(
  ComponentManifest.parse({
    id: "pr-queue",
    version: "0.3.0",
    kind: "widget",
    title: "PR",
    reads: [],
    writes: [],
  }),
  H,
);
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; " +
  "connect-src 'none'; frame-ancestors http://127.0.0.1:4317 http://localhost:4317; base-uri 'none'; form-action 'none'";
let trust: "trusted" | "sandboxed" | null = "sandboxed";
let lookups: string[] = [];
let answer: typeof stored = stored;
const assets: AssetLookup = (id, version, hash) => {
  lookups.push(`${id}@${version}/${hash}`);
  return trust && id === "pr-queue" && version === "0.3.0" && hash === H ? { stored: answer, trust } : null;
};
const servers: { stop(): void }[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.stop();
  trust = "sandboxed";
  lookups = [];
  answer = stored;
});
function start() {
  const s = startSandboxServer({ port: 0, uiPort: 4317, assets });
  servers.push(s);
  return s;
}
const get = (s: { port: number }, path: string, headers: Record<string, string> = {}) =>
  fetch(`http://127.0.0.1:${s.port}${path}`, { headers: { host: `127.0.0.1:${s.port}`, ...headers } });

describe("sandbox server", () => {
  test("listens on loopback only", () => {
    expect(start().url).toStartWith("http://127.0.0.1:");
  });

  test("serves the three files of an active version with the sandbox headers", async () => {
    const s = start();
    const html = await get(s, `/c/pr-queue/0.3.0/${H}/index.html`);
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toContain("text/html");
    const page = await html.text();
    expect(page).toContain('<script type="module" src="ui.sandbox.js"></script>');
    expect(page).toContain('<link rel="stylesheet" href="ui.css" crossorigin="anonymous">');
    expect(html.headers.get("content-security-policy")).toBe(CSP);
    expect(html.headers.get("x-content-type-options")).toBe("nosniff");
    expect(html.headers.get("referrer-policy")).toBe("no-referrer");
    expect(html.headers.get("cross-origin-resource-policy")).toBe("same-site");
    expect(html.headers.get("set-cookie")).toBeNull();
    expect(html.headers.get("access-control-allow-origin")).toBeNull();
    const js = await get(s, `/c/pr-queue/0.3.0/${H}/ui.sandbox.js`);
    expect(await js.text()).toBe("sandbox:pr-queue@0.3.0");
    expect(js.headers.get("content-type")).toContain("javascript");
    expect(js.headers.get("access-control-allow-origin")).toBe("*");
    expect(js.headers.get("content-security-policy")).toBe(CSP);
    const css = await get(s, `/c/pr-queue/0.3.0/${H}/ui.css`);
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toContain("text/css");
    expect(css.headers.get("access-control-allow-origin")).toBe("*");
    expect(css.headers.get("cross-origin-resource-policy")).toBe("same-site");
  });

  test("anything else is a 404 without a cookie, even with a session cookie", async () => {
    const s = start();
    for (const path of [
      `/c/pr-queue/0.3.0/${H}/ui.trusted.js`,
      `/c/pr-queue/0.3.0/${H}/server.js`,
      `/c/pr-queue/0.3.0/${OTHER}/index.html`,
      `/c/pr-queue/0.3.0/${H}/../../x`,
      `/c/pr-queue/0.3.0/${H}/..%2F..%2Fx`,
      `/c/pr-queue/0.3.0/${H}/%2e%2e/index.html`,
      `/c/pr-queue%2F..%2F..%2Fetc/0.3.0/${H}/index.html`,
      `/c/PR-QUEUE/0.3.0/${H}/index.html`,
      `/c/pr-queue/0.3/${H}/index.html`,
      `/c/pr-queue/0.3.0/${H.toUpperCase()}/index.html`,
      `/c/pr-queue/0.3.0/${H}/index.html/extra`,
      "/api/rpc",
      "/api/pair",
      `/components/pr-queue/0.3.0/${H}/ui.trusted.js`,
      "/",
    ]) {
      const res = await get(s, path, { cookie: "kibo_session=x" });
      expect(res.status).toBe(404);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect(lookups).toEqual([`pr-queue@0.3.0/${OTHER}`]);
    const post = await fetch(`http://127.0.0.1:${s.port}/c/pr-queue/0.3.0/${H}/index.html`, {
      method: "POST",
    });
    expect(post.status).toBe(405);
  });

  test("a version that loses its trust stops being served; a wrong Host is refused", async () => {
    const s = start();
    trust = null;
    expect((await get(s, `/c/pr-queue/0.3.0/${H}/index.html`)).status).toBe(404);
    trust = "sandboxed";
    expect((await get(s, `/c/pr-queue/0.3.0/${H}/index.html`, { host: "evil.test" })).status).toBe(403);
    expect((await get(s, `/c/pr-queue/0.3.0/${H}/index.html`, { host: "localhost:4317" })).status).toBe(403);
  });

  test("files whose stored hash differs from the URL are never served", async () => {
    const s = start();
    answer = { ...stored, hash: OTHER };
    expect((await get(s, `/c/pr-queue/0.3.0/${H}/ui.sandbox.js`)).status).toBe(404);
    answer = { ...stored, version: "0.4.0" };
    expect((await get(s, `/c/pr-queue/0.3.0/${H}/ui.sandbox.js`)).status).toBe(404);
  });
});
