import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./server";
import { createService } from "./service";
import { openStore, type Store } from "./store";

let home: string;
let store: Store;
const TOKEN = "a".repeat(64);

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-srv-"));
  store = openStore(home);
});
afterEach(() => {
  store.close();
  rmSync(home, { recursive: true, force: true });
});

describe("ui files", () => {
  test("serves files from the ui folder and never outside it", async () => {
    const root = mkdtempSync(join(tmpdir(), "kibo-ui-"));
    const uiDir = join(root, "ui");
    mkdirSync(uiDir);
    mkdirSync(join(root, "ui-evil"));
    writeFileSync(join(uiDir, "index.html"), "<p>kibo</p>");
    writeFileSync(join(uiDir, "app.js"), "run()");
    writeFileSync(join(root, "ui-evil", "secret"), "stolen");
    writeFileSync(join(root, "secret"), "stolen");
    const ui = startServer({ service: createService(store, { user: "adam" }), token: TOKEN, port: 0, uiDir });
    const get = async (path: string) => (await fetch(`${ui.url}${path}`)).text();
    const statusOf = async (path: string) => (await fetch(`${ui.url}${path}`)).status;
    expect(await get("/app.js")).toBe("run()");
    expect(await get("/projects/KIB")).toBe("<p>kibo</p>");
    expect(await get("/..%2Fui-evil%2Fsecret")).not.toBe("stolen");
    expect(await get("/..%2Fsecret")).not.toBe("stolen");
    expect(await get("/%2e%2e/secret")).not.toBe("stolen");
    expect(await statusOf("/..%2Fui-evil%2Fsecret")).toBe(403);
    ui.stop();
    rmSync(root, { recursive: true, force: true });
  });

  test("ui responses carry the security headers", async () => {
    const uiDir = mkdtempSync(join(tmpdir(), "kibo-ui-"));
    writeFileSync(join(uiDir, "index.html"), "<p>kibo</p>");
    writeFileSync(join(uiDir, "app.js"), "run()");
    const ui = startServer({ service: createService(store, { user: "adam" }), token: TOKEN, port: 0, uiDir });
    for (const path of ["/", "/app.js", "/projects/KIB", "/%00"]) {
      const res = await fetch(`${ui.url}${path}`);
      expect(res.headers.get("content-security-policy")).toBe(
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
          "font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; frame-ancestors 'none'; " +
          "base-uri 'none'; form-action 'self'",
      );
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    }
    ui.stop();
    rmSync(uiDir, { recursive: true, force: true });
  });

  test("only an existing worker script gets the worker policy, never the document", async () => {
    const uiDir = mkdtempSync(join(tmpdir(), "kibo-ui-"));
    mkdirSync(join(uiDir, "workers", "sub"), { recursive: true });
    mkdirSync(join(uiDir, "assets"));
    writeFileSync(join(uiDir, "index.html"), "<p>kibo</p>");
    writeFileSync(join(uiDir, "workers", "draft-preview-worker-abc.js"), "work()");
    writeFileSync(join(uiDir, "workers", "sub", "x.js"), "nested()");
    writeFileSync(join(uiDir, "workers", "x.css"), "a{}");
    writeFileSync(join(uiDir, "assets", "x.js"), "asset()");
    const ui = startServer({
      service: createService(store, { user: "adam" }),
      token: TOKEN,
      port: 0,
      uiDir,
      sandboxOrigin: () => "http://127.0.0.1:9999",
    });
    const worker = await fetch(`${ui.url}/workers/draft-preview-worker-abc.js`);
    expect(await worker.text()).toBe("work()");
    expect(worker.headers.get("content-security-policy")).toBe(
      "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'",
    );
    expect(worker.headers.get("x-content-type-options")).toBe("nosniff");
    expect(worker.headers.get("referrer-policy")).toBe("no-referrer");
    const strict = (csp: string | null) =>
      csp?.startsWith("default-src 'self'; script-src 'self'; style-src") === true &&
      csp.includes("frame-src http://127.0.0.1:9999") &&
      !csp.includes("wasm");
    for (const path of [
      "/workers/absent.js",
      "/workers/sub/x.js",
      "/workers/x.css",
      "/assets/x.js",
      "/",
      "/workers/..%2Findex.html",
    ]) {
      const res = await fetch(`${ui.url}${path}`);
      expect({ path, strict: strict(res.headers.get("content-security-policy")) }).toEqual({
        path,
        strict: true,
      });
    }
    expect(await (await fetch(`${ui.url}/workers/absent.js`)).text()).toBe("<p>kibo</p>");
    expect(await (await fetch(`${ui.url}/workers/..%2Findex.html`)).text()).toBe("<p>kibo</p>");
    ui.stop();
    rmSync(uiDir, { recursive: true, force: true });
  });

  test("a symbolic link that leaves the ui folder is refused; one that stays inside is served by its real path", async () => {
    const root = mkdtempSync(join(tmpdir(), "kibo-ui-"));
    const uiDir = join(root, "ui");
    mkdirSync(join(uiDir, "workers"), { recursive: true });
    mkdirSync(join(uiDir, "assets"));
    writeFileSync(join(uiDir, "index.html"), "<p>kibo</p>");
    writeFileSync(join(root, "outside.js"), "stolen()");
    writeFileSync(join(uiDir, "assets", "real.js"), "real()");
    writeFileSync(join(uiDir, "workers", "real-worker.js"), "work()");
    symlinkSync(join(root, "outside.js"), join(uiDir, "workers", "evil.js"));
    symlinkSync(join(root, "outside.js"), join(uiDir, "assets", "evil.js"));
    symlinkSync(join(uiDir, "assets", "real.js"), join(uiDir, "assets", "alias.js"));
    symlinkSync(join(uiDir, "assets", "real.js"), join(uiDir, "workers", "alias.js"));
    symlinkSync(join(uiDir, "workers", "real-worker.js"), join(uiDir, "workers", "worker-alias.js"));
    const ui = startServer({ service: createService(store, { user: "adam" }), token: TOKEN, port: 0, uiDir });
    const worker = (csp: string | null) => csp?.includes("wasm-unsafe-eval") === true;
    for (const path of ["/workers/evil.js", "/assets/evil.js"]) {
      const res = await fetch(`${ui.url}${path}`);
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
      expect(worker(res.headers.get("content-security-policy"))).toBe(false);
      expect(await res.text()).not.toBe("stolen()");
    }
    const inside = await fetch(`${ui.url}/assets/alias.js`);
    expect(await inside.text()).toBe("real()");
    const aliasInWorkers = await fetch(`${ui.url}/workers/alias.js`);
    expect(await aliasInWorkers.text()).toBe("real()");
    expect(worker(aliasInWorkers.headers.get("content-security-policy"))).toBe(false);
    const workerAlias = await fetch(`${ui.url}/workers/worker-alias.js`);
    expect(await workerAlias.text()).toBe("work()");
    expect(worker(workerAlias.headers.get("content-security-policy"))).toBe(true);
    ui.stop();
    rmSync(root, { recursive: true, force: true });
  });

  test("a linked folder that leaves the ui folder is refused, even through an encoded path", async () => {
    const root = mkdtempSync(join(tmpdir(), "kibo-ui-"));
    const uiDir = join(root, "ui");
    mkdirSync(join(root, "outside"));
    mkdirSync(uiDir);
    writeFileSync(join(uiDir, "index.html"), "<p>kibo</p>");
    writeFileSync(join(root, "outside", "secret.js"), "stolen()");
    symlinkSync(join(root, "outside"), join(uiDir, "workers"));
    const ui = startServer({ service: createService(store, { user: "adam" }), token: TOKEN, port: 0, uiDir });
    for (const path of ["/workers/secret.js", "/workers%2Fsecret.js", "/%77orkers/secret.js"]) {
      const res = await fetch(`${ui.url}${path}`);
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
      expect(res.headers.get("content-security-policy")?.includes("wasm-unsafe-eval")).toBe(false);
      expect(await res.text()).not.toBe("stolen()");
    }
    ui.stop();
    rmSync(root, { recursive: true, force: true });
  });

  test("an unreadable ui path is a clean 400", async () => {
    const uiDir = mkdtempSync(join(tmpdir(), "kibo-ui-"));
    writeFileSync(join(uiDir, "index.html"), "<p>kibo</p>");
    const ui = startServer({ service: createService(store, { user: "adam" }), token: TOKEN, port: 0, uiDir });
    for (const path of ["/app%00.js", "/%00", `/${"a".repeat(5000)}`]) {
      const res = await fetch(`${ui.url}${path}`);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("bad path");
    }
    ui.stop();
    rmSync(uiDir, { recursive: true, force: true });
  });
});
