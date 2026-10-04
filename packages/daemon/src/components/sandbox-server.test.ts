import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComponentManifest } from "@kibo/schema";
import type { DraftAssets } from "../ai/draft-preview";
import { GLB, PNG } from "../files/files.test-helper";
import { storedVersion } from "./fake-store.test-helper";
import { type AssetLookup, type FileOpener, sandboxHeaders, startSandboxServer } from "./sandbox-server";

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
const CSP_AUDIO_ASSETS = CSP.replace(
  "font-src 'self' data:; connect-src 'none'",
  "font-src 'self' data:; media-src 'self' blob: data:; connect-src 'self'",
);
let trust: "trusted" | "sandboxed" | null = "sandboxed";
let lookups: string[] = [];
let answer: typeof stored = stored;
const assets: AssetLookup = (id, version, hash) => {
  lookups.push(`${id}@${version}/${hash}`);
  return trust && id === "pr-queue" && version === "0.3.0" && hash === H
    ? { stored: answer, trust, capabilities: [] }
    : null;
};
const servers: { stop(): void }[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.stop();
  trust = "sandboxed";
  lookups = [];
  answer = stored;
});
function start(
  lookup: AssetLookup = assets,
  extraAncestors?: string[],
  drafts?: DraftAssets,
  files?: FileOpener,
) {
  const s = startSandboxServer({
    port: 0,
    uiPort: 4317,
    assets: lookup,
    ...(extraAncestors && { extraAncestors }),
    ...(drafts && { drafts }),
    ...(files && { files }),
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
    expect(page).toContain("<style>html,body,#root{height:100%}</style>");
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

describe("capabilities", () => {
  test("the csp widens only for the capabilities the active version was granted", async () => {
    const s = start((id, _version, hash) =>
      id === "pr-queue" && hash === H
        ? { stored, trust: "sandboxed", capabilities: ["audio", "assets"] }
        : null,
    );
    const res = await get(s, `/c/pr-queue/0.3.0/${H}/index.html`);
    expect(res.headers.get("content-security-policy")).toBe(CSP_AUDIO_ASSETS);
    expect(sandboxHeaders(4317)["content-security-policy"]).toBe(CSP);
    expect(sandboxHeaders(4317, [], [])["content-security-policy"]).toBe(CSP);
    expect(sandboxHeaders(4317, [], ["webgl", "gamepad", "fullscreen"])["content-security-policy"]).toBe(CSP);
    expect(sandboxHeaders(4317, [], ["audio"])["content-security-policy"]).toContain(
      "media-src 'self' blob: data:; connect-src 'none'",
    );
    expect(sandboxHeaders(4317, [], ["assets"])["content-security-policy"]).not.toContain("media-src");
  });

  test("a second version without the capability is served with the strict csp", async () => {
    const two = storedVersion(
      ComponentManifest.parse({ ...stored.manifest, version: "0.4.0", capabilities: ["assets"] }),
      OTHER,
    );
    const s = start((_id, version, hash) =>
      version === "0.3.0" && hash === H
        ? { stored, trust: "sandboxed", capabilities: ["assets"] }
        : version === "0.4.0" && hash === OTHER
          ? { stored: two, trust: "sandboxed", capabilities: [] }
          : null,
    );
    const first = (await get(s, `/c/pr-queue/0.3.0/${H}/index.html`)).headers.get("content-security-policy");
    expect(first).toContain("connect-src 'self'");
    const second = await get(s, `/c/pr-queue/0.4.0/${OTHER}/index.html`);
    expect(second.headers.get("content-security-policy")).toBe(CSP);
  });

  test("a 404 keeps the strict csp whatever the capabilities", async () => {
    const s = start(() => ({ stored, trust: "sandboxed", capabilities: ["audio", "assets"] }));
    const res = await get(s, `/c/pr-queue/0.3.0/${H}/server.js`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-security-policy")).toBe(CSP);
  });
});

describe("project files", () => {
  const T = "a".repeat(64);
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  function served(
    write: (dir: string) => void,
    opened: { name?: string; size?: number; file?: string } = {},
  ) {
    const dir = mkdtempSync(join(tmpdir(), "kibo-files-"));
    dirs.push(dir);
    write(dir);
    const files: FileOpener = {
      open: async (token) =>
        token === T
          ? {
              path: join(dir, opened.file ?? "robot.glb"),
              name: opened.name ?? "robot.glb",
              mime: "model/gltf-binary",
              size: opened.size ?? GLB.byteLength,
            }
          : null,
    };
    return start(assets, undefined, undefined, files);
  }
  const glb = (dir: string) => writeFileSync(join(dir, "robot.glb"), GLB);

  test("project files are served by token with a strict content type", async () => {
    const s = served(glb);
    const ok = await get(s, `/f/${T}/robot.glb`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("model/gltf-binary");
    expect(ok.headers.get("content-length")).toBe(String(GLB.byteLength));
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(ok.headers.get("access-control-allow-origin")).toBe("*");
    expect(ok.headers.get("cross-origin-resource-policy")).toBe("same-site");
    expect(ok.headers.get("content-security-policy")).toBe("default-src 'none'; sandbox");
    expect(ok.headers.get("cache-control")).toBe("private, max-age=900");
    expect(ok.headers.get("referrer-policy")).toBe("no-referrer");
    expect(ok.headers.get("accept-ranges")).toBe("none");
    expect(ok.headers.get("set-cookie")).toBeNull();
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(GLB);
    for (const bad of [
      `/f/${T}/other.glb`,
      `/f/${"0".repeat(64)}/robot.glb`,
      `/f/${T}/robot.glb/x`,
      `/f/${T}`,
      "/f/short/robot.glb",
    ])
      expect((await get(s, bad)).status).toBe(404);
  });

  test("only GET and HEAD from the loopback host are answered", async () => {
    const s = served(glb);
    const head = await fetch(`http://127.0.0.1:${s.port}/f/${T}/robot.glb`, {
      method: "HEAD",
      headers: { host: `127.0.0.1:${s.port}` },
    });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe(String(GLB.byteLength));
    expect((await head.arrayBuffer()).byteLength).toBe(0);
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"])
      expect(
        (
          await fetch(`http://127.0.0.1:${s.port}/f/${T}/robot.glb`, {
            method,
            headers: { host: `127.0.0.1:${s.port}` },
          })
        ).status,
      ).toBe(405);
    expect((await get(s, `/f/${T}/robot.glb`, { host: "evil.test" })).status).toBe(403);
  });

  test("the name in the url must be the one the token was minted for", async () => {
    const s = served(glb, { name: "other.glb" });
    expect((await get(s, `/f/${T}/robot.glb`)).status).toBe(404);
    expect((await get(s, `/f/${T}/other.glb`)).status).toBe(200);
  });

  test("the length comes from the opened file, not from the lookup", async () => {
    const s = served(glb, { size: 9999 });
    const ok = await get(s, `/f/${T}/robot.glb`);
    expect(ok.headers.get("content-length")).toBe(String(GLB.byteLength));
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(GLB);
  });

  test("a symbolic link, a missing file or a lying signature is a 404, never a 500", async () => {
    const link = served((dir) => {
      writeFileSync(join(dir, "real.glb"), GLB);
      symlinkSync(join(dir, "real.glb"), join(dir, "robot.glb"));
    });
    expect((await get(link, `/f/${T}/robot.glb`)).status).toBe(404);
    const missing = served(() => {});
    expect((await get(missing, `/f/${T}/robot.glb`)).status).toBe(404);
    const lying = served((dir) => writeFileSync(join(dir, "robot.glb"), PNG));
    expect((await get(lying, `/f/${T}/robot.glb`)).status).toBe(404);
    const folder = served(() => {}, { file: "." });
    expect((await get(folder, `/f/${T}/robot.glb`)).status).toBe(404);
  });

  test("a failing lookup is a 404 and is logged without the request", async () => {
    const logged: unknown[][] = [];
    const spy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
    try {
      const s = start(assets, undefined, undefined, {
        open: async () => {
          throw new Error("disk gone");
        },
      });
      const res = await get(s, `/f/${T}/robot.glb`, { cookie: "kibo_session=secret-cookie" });
      expect(res.status).toBe(404);
      expect(JSON.stringify(logged.map((args) => args.map(String)))).toContain("disk gone");
      expect(JSON.stringify(logged.map((args) => args.map(String)))).not.toContain("secret-cookie");
    } finally {
      spy.mockRestore();
    }
  });

  test("without a file opener every token is a 404", async () => {
    expect((await get(start(), `/f/${T}/robot.glb`)).status).toBe(404);
  });
});

describe("draft previews", () => {
  const DRAFT = "0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11";
  const BUNDLE = new TextEncoder().encode("draft-bundle");
  const asked: string[] = [];
  let draftCapabilities: ComponentManifest["capabilities"] = [];
  const drafts: DraftAssets = {
    async manifest(draftId) {
      if (draftId !== DRAFT) return null;
      return ComponentManifest.parse({ ...stored.manifest, capabilities: draftCapabilities });
    },
    async lookup(draftId, hash, file) {
      asked.push(`${draftId}/${hash}/${file}`);
      if (draftId !== DRAFT || hash !== H) return null;
      return file === "index.html" ? "<!doctype html>draft" : file === "ui.css" ? ".d{}" : BUNDLE;
    },
  };
  afterEach(() => {
    asked.length = 0;
    draftCapabilities = [];
  });

  test("a draft's csp follows the capabilities of its own manifest", async () => {
    const s = start(assets, undefined, drafts);
    draftCapabilities = ["audio", "assets"];
    const html = await get(s, `/c/drafts/${DRAFT}/${H}/index.html`);
    expect(html.headers.get("content-security-policy")).toBe(CSP_AUDIO_ASSETS);
    draftCapabilities = [];
    expect((await get(s, `/c/drafts/${DRAFT}/${H}/index.html`)).headers.get("content-security-policy")).toBe(
      CSP,
    );
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
