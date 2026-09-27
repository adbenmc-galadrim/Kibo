import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
