import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { ComponentManifest } from "@kibo/schema";
import type { DraftAssets } from "../ai/draft-preview";
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
function start(lookup: AssetLookup = assets, extraAncestors?: string[], drafts?: DraftAssets) {
  const s = startSandboxServer({
    port: 0,
    uiPort: 4317,
    assets: lookup,
    ...(extraAncestors && { extraAncestors }),
    ...(drafts && { drafts }),
  });
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

  test("in dev, the Vite origin may frame the sandbox too", async () => {
    const s = start(assets, ["http://localhost:5173"]);
    const html = await get(s, `/c/pr-queue/0.3.0/${H}/index.html`);
    expect(html.headers.get("content-security-policy")).toEndWith(
      "frame-ancestors http://127.0.0.1:4317 http://localhost:4317 http://localhost:5173; base-uri 'none'; form-action 'none'",
    );
  });

  test("a failing request is answered without logging its headers", async () => {
    const logged: unknown[][] = [];
    const spies = (["error", "warn", "log", "info", "debug"] as const).map((level) =>
      spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      }),
    );
    try {
      const s = start(() => {
        throw new Error("lookup failed");
      });
      const res = await get(s, `/c/pr-queue/0.3.0/${H}/index.html`, { cookie: "kibo_session=secret-cookie" });
      expect(res.status).toBe(500);
      expect(res.headers.get("content-security-policy")).toBe(CSP);
      expect(logged.length).toBeGreaterThan(0);
      expect(JSON.stringify(logged.map((args) => args.map(String)))).not.toContain("secret-cookie");
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe("draft previews", () => {
  const DRAFT = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
  const BUNDLE = new TextEncoder().encode("draft-bundle");
  const asked: string[] = [];
  const drafts: DraftAssets = {
    async lookup(draftId, hash, file) {
      asked.push(`${draftId}/${hash}/${file}`);
      if (draftId !== DRAFT || hash !== H) return null;
      return file === "index.html" ? "<!doctype html>draft" : file === "ui.css" ? ".d{}" : BUNDLE;
    },
  };
  afterEach(() => {
    asked.length = 0;
  });

  test("a draft's files are served with the sandbox headers, without cache", async () => {
    const s = start(assets, undefined, drafts);
    const js = await get(s, `/c/drafts/${DRAFT}/${H}/ui.sandbox.js`);
    expect(js.status).toBe(200);
    expect(await js.text()).toBe("draft-bundle");
    expect(js.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(js.headers.get("content-security-policy")).toBe(CSP);
    expect(js.headers.get("cache-control")).toBe("no-store");
    expect(js.headers.get("x-content-type-options")).toBe("nosniff");
    expect(js.headers.get("referrer-policy")).toBe("no-referrer");
    expect(js.headers.get("cross-origin-resource-policy")).toBe("same-site");
    expect(js.headers.get("access-control-allow-origin")).toBe("*");
    const html = await get(s, `/c/drafts/${DRAFT}/${H}/index.html`);
    expect(html.headers.get("content-type")).toContain("text/html");
    expect(html.headers.get("access-control-allow-origin")).toBeNull();
    expect(html.headers.get("cache-control")).toBe("no-store");
    const css = await get(s, `/c/drafts/${DRAFT}/${H}/ui.css`);
    expect(css.headers.get("content-type")).toContain("text/css");
  });

  test("a lookup that finds nothing, an invalid path or a missing provider is a 404", async () => {
    const s = start(assets, undefined, drafts);
    expect((await get(s, `/c/drafts/${DRAFT}/${OTHER}/ui.sandbox.js`)).status).toBe(404);
    for (const path of [
      `/c/drafts/not-a-uuid/${H}/ui.sandbox.js`,
      `/c/drafts/${DRAFT}/${H}/ui.tsx`,
      `/c/drafts/${DRAFT}/${H}/kibo.component.json`,
      `/c/drafts/${DRAFT}.attachments/${H}/1-maquette.png`,
      `/c/drafts/${DRAFT}/${H}/../../${DRAFT}.attachments/1-maquette.png`,
      `/c/drafts/${DRAFT}/${H}/%2e%2e/ui.tsx`,
      `/c/drafts/${DRAFT}/..%2F..%2F/ui.sandbox.js`,
    ]) {
      const res = await get(s, path, { cookie: "kibo_session=x" });
      expect(res.status).toBe(404);
      expect(res.headers.get("content-security-policy")).toBe(CSP);
    }
    expect(asked).toEqual([`${DRAFT}/${OTHER}/ui.sandbox.js`]);
    const bare = start();
    expect((await get(bare, `/c/drafts/${DRAFT}/${H}/ui.sandbox.js`)).status).toBe(404);
    expect((await get(s, `/c/drafts/${DRAFT}/${H}/ui.sandbox.js`, { host: "evil.test" })).status).toBe(403);
    const post = await fetch(`http://127.0.0.1:${s.port}/c/drafts/${DRAFT}/${H}/ui.sandbox.js`, {
      method: "POST",
    });
    expect(post.status).toBe(405);
  });

  test("installed components are still served next to the drafts", async () => {
    const s = start(assets, undefined, drafts);
    expect(await (await get(s, `/c/pr-queue/0.3.0/${H}/ui.sandbox.js`)).text()).toBe(
      "sandbox:pr-queue@0.3.0",
    );
  });
});
