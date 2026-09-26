import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComponentManifest, KiboError, type KiboErrorCode } from "@kibo/schema";
import { storedVersion } from "./components/fake-store.test-helper";
import type { AssetLookup } from "./components/sandbox-server";
import { type ServerOptions, startServer } from "./server";
import { createService, type Service } from "./service";
import { openStore, type Store } from "./store";

const TOKEN = "a".repeat(64);
const H = "e".repeat(64);
const OTHER = "f".repeat(64);
const SANDBOX = "http://127.0.0.1:4318";
const manifest = ComponentManifest.parse({
  id: "mine",
  version: "1.0.0",
  kind: "widget",
  title: "Mine",
  reads: [],
  writes: [],
});
const stored = storedVersion(manifest, H);
let trust: "trusted" | "sandboxed" = "trusted";
let answer = stored;
let lookups = 0;
const assets: AssetLookup = (id, version, hash) => {
  lookups += 1;
  return id === "mine" && version === "1.0.0" && hash === H ? { stored: answer, trust } : null;
};

let home: string;
let uiDir: string;
let store: Store;
const stops: (() => void)[] = [];

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-srv-cmp-"));
  uiDir = mkdtempSync(join(tmpdir(), "kibo-ui-"));
  writeFileSync(join(uiDir, "index.html"), "<p>kibo</p>");
  store = openStore(home);
  trust = "trusted";
  answer = stored;
  lookups = 0;
});
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
  rmSync(uiDir, { recursive: true, force: true });
});

async function startPaired(
  extra: Partial<ServerOptions> = {},
  service: Service = createService(store, { user: "adam" }),
) {
  const srv = startServer({ service, token: TOKEN, port: 0, uiDir, ...extra });
  stops.push(srv.stop);
  const paired = await fetch(`${srv.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: srv.url },
    body: JSON.stringify({ token: TOKEN }),
  });
  expect(paired.status).toBe(204);
  return { base: srv.url, cookie: paired.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

describe("trusted component modules", () => {
  const url = (base: string, file = "ui.trusted.js", hash = H) =>
    `${base}/components/mine/1.0.0/${hash}/${file}`;

  test("served from memory to a paired session only, with exact headers", async () => {
    const { base, cookie } = await startPaired({ assets, sandboxOrigin: () => SANDBOX });
    expect((await fetch(url(base))).status).toBe(401);
    expect((await fetch(url(base), { headers: { cookie: "kibo_session=forged" } })).status).toBe(401);
    expect(lookups).toBe(0);
    const ok = await fetch(url(base), { headers: { cookie, origin: base } });
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("trusted:mine@1.0.0");
    expect(Object.fromEntries(ok.headers)).toMatchObject({
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
    });
    expect(ok.headers.get("access-control-allow-origin")).toBeNull();
    expect(ok.headers.get("set-cookie")).toBeNull();
    const css = await fetch(url(base, "ui.css"), { headers: { cookie } });
    expect(css.status).toBe(200);
    expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");
  });

  test("a foreign origin or Host is refused before any lookup", async () => {
    const { base, cookie } = await startPaired({ assets });
    expect((await fetch(url(base), { headers: { cookie, origin: "http://evil.test" } })).status).toBe(403);
    expect((await fetch(url(base), { headers: { cookie, origin: SANDBOX } })).status).toBe(403);
    expect((await fetch(url(base), { headers: { cookie, origin: "null" } })).status).toBe(403);
    expect((await fetch(url(base), { headers: { cookie, host: "evil.test" } })).status).toBe(403);
    expect(lookups).toBe(0);
  });

  test("only a trusted version with the URL hash is served", async () => {
    const { base, cookie } = await startPaired({ assets });
    expect((await fetch(url(base, "ui.trusted.js", OTHER), { headers: { cookie } })).status).toBe(404);
    trust = "sandboxed";
    expect((await fetch(url(base), { headers: { cookie } })).status).toBe(403);
    expect((await fetch(url(base, "ui.css"), { headers: { cookie } })).status).toBe(403);
    trust = "trusted";
    answer = { ...stored, hash: OTHER };
    expect((await fetch(url(base), { headers: { cookie } })).status).toBe(404);
  });

  test("other files, malformed segments and traversal are 404 without a lookup", async () => {
    const { base, cookie } = await startPaired({ assets });
    for (const path of [
      `/components/mine/1.0.0/${H}/server.js`,
      `/components/mine/1.0.0/${H}/ui.sandbox.js`,
      `/components/mine/1.0.0/${H}/index.html`,
      `/components/mine/1.0.0/${H}/..%2Fui.trusted.js`,
      `/components/mine%2F..%2F..%2Fx/1.0.0/${H}/ui.trusted.js`,
      `/components/Mine/1.0.0/${H}/ui.trusted.js`,
      `/components/mine/1.0/${H}/ui.trusted.js`,
      `/components/mine/1.0.0/${H.slice(1)}/ui.trusted.js`,
      `/components/mine/1.0.0/${H}/ui.trusted.js/x`,
      "/components/",
    ]) {
      expect((await fetch(`${base}${path}`, { headers: { cookie } })).status).toBe(404);
    }
    const post = await fetch(url(base), { method: "POST", headers: { cookie, origin: base } });
    expect(post.status).toBe(404);
    expect(lookups).toBe(0);
  });

  test("without an asset lookup nothing is served", async () => {
    const { base, cookie } = await startPaired();
    expect((await fetch(url(base), { headers: { cookie } })).status).toBe(404);
  });
});

describe("ui content security policy", () => {
  test("allows frames from the sandbox origin only", async () => {
    const { base } = await startPaired({ assets, sandboxOrigin: () => SANDBOX });
    expect((await fetch(`${base}/`)).headers.get("content-security-policy")).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
        `font-src 'self' data:; connect-src 'self'; frame-src ${SANDBOX}; frame-ancestors 'none'; ` +
        "base-uri 'none'; form-action 'self'",
    );
  });

  test("allows no foreign frame while the sandbox origin is unknown", async () => {
    const { base } = await startPaired({ assets, sandboxOrigin: () => null });
    const csp = (await fetch(`${base}/`)).headers.get("content-security-policy") ?? "";
    expect(csp).not.toContain("frame-src");
    expect(csp).toStartWith("default-src 'self';");
  });
});

describe("component error statuses", () => {
  test("component errors answer their HTTP status", async () => {
    const cases: [KiboErrorCode, number][] = [
      ["TRUST_REQUIRED", 403],
      ["PERMISSION_DENIED", 403],
      ["RATE_LIMITED", 429],
      ["TIMEOUT", 504],
      ["COMPONENT_CRASHED", 502],
    ];
    for (const [code, status] of cases) {
      const failing: Service = {
        ...createService(store, { user: "adam" }),
        handle: () => {
          throw new KiboError(code, "refused");
        },
      };
      const { base, cookie } = await startPaired({}, failing);
      const res = await fetch(`${base}/api/rpc`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base, cookie },
        body: JSON.stringify({ method: "listProjects" }),
      });
      expect(res.status).toBe(status);
      expect(await res.json()).toMatchObject({ ok: false, error: { code } });
    }
  });
});
