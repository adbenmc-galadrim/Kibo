import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import type { HookSink } from "./agents/hook-route";
import { loadOrCreateToken } from "./auth";
import { startServer } from "./server";
import { createService, type Service } from "./service";
import { openStore, type Store } from "./store";

let home: string;
let store: Store;
let server: ReturnType<typeof startServer>;
let origin: string;
const TOKEN = "a".repeat(64);

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "kibo-srv-"));
  store = openStore(home);
  server = startServer({
    service: createService(store, { user: "adam" }),
    token: TOKEN,
    port: 0,
    uiDir: null,
  });
  origin = server.url;
});
afterEach(() => {
  server.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${server.url}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...headers },
    body: JSON.stringify(body),
  });

async function pair(): Promise<string> {
  const res = await post("/api/pair", { token: TOKEN });
  expect(res.status).toBe(204);
  const cookie = res.headers.get("set-cookie") ?? "";
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Strict");
  return cookie.split(";")[0] ?? "";
}

describe("pairing and auth", () => {
  test("listens on loopback only", () => {
    expect(server.url).toStartWith("http://127.0.0.1:");
  });

  test("a wrong token is refused", async () => {
    expect((await post("/api/pair", { token: "b".repeat(64) })).status).toBe(401);
  });

  test("rpc without a session is refused and writes nothing", async () => {
    expect((await post("/api/rpc", { method: "listProjects" })).status).toBe(401);
    const res = await post("/api/rpc", {
      method: "createProject",
      name: "X",
      key: "XX",
      folder: null,
      color: "#000000",
    });
    expect(res.status).toBe(401);
    const cookie = await pair();
    const list = await (await post("/api/rpc", { method: "listProjects" }, { cookie })).json();
    expect(list).toEqual({ ok: true, result: [] });
  });

  test("a foreign or missing origin is refused even with a session", async () => {
    const cookie = await pair();
    expect(
      (await post("/api/rpc", { method: "listProjects" }, { cookie, origin: "http://evil.test" })).status,
    ).toBe(403);
    const noOrigin = await fetch(`${server.url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ method: "listProjects" }),
    });
    expect(noOrigin.status).toBe(403);
  });

  test("a foreign Host header is refused (DNS rebinding)", async () => {
    const cookie = await pair();
    const res = await post("/api/rpc", { method: "listProjects" }, { cookie, host: "evil.test" });
    expect(res.status).toBe(403);
  });

  test("domain errors come back as typed errors", async () => {
    const cookie = await pair();
    const res = await post("/api/rpc", { method: "getProject", projectId: "nope" }, { cookie });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    const bad = await post("/api/rpc", { method: "dropDatabase" }, { cookie });
    expect(bad.status).toBe(400);
  });

  test("api responses are never cached", async () => {
    const paired = await post("/api/pair", { token: TOKEN });
    expect(paired.headers.get("cache-control")).toBe("no-store");
    const refused = await post("/api/rpc", { method: "listProjects" });
    expect(refused.headers.get("cache-control")).toBe("no-store");
    const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
    const ok = await post("/api/rpc", { method: "listProjects" }, { cookie });
    expect(ok.headers.get("cache-control")).toBe("no-store");
  });

  test("oversized request bodies are rejected", async () => {
    const cookie = await pair();
    const res = await post("/api/rpc", { method: "listProjects", pad: "x".repeat(1_100_000) }, { cookie });
    expect(res.status).toBe(413);
  });

  test("websocket needs a session and receives changes", async () => {
    const wsUrl = `${server.url.replace("http", "ws")}/api/events`;
    const refused = new WebSocket(wsUrl, { headers: { origin } });
    const closed = await new Promise<boolean>((r) => {
      refused.onopen = () => r(false);
      refused.onerror = () => r(true);
      refused.onclose = () => r(true);
    });
    expect(closed).toBe(true);

    const cookie = await pair();
    const ws = new WebSocket(wsUrl, { headers: { origin, cookie } });
    await new Promise((r) => {
      ws.onopen = r;
    });
    const message = new Promise<string>((r) => {
      ws.onmessage = (e) => r(String(e.data));
    });
    await post(
      "/api/rpc",
      { method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" },
      { cookie },
    );
    expect(JSON.parse(await message)).toEqual({ projectId: null });
    ws.close();
  });
});

describe("unexpected failures", () => {
  test("a non-domain error is reported as INTERNAL without details", async () => {
    const failing: Service = {
      ...createService(store, { user: "adam" }),
      handle: () => {
        throw new Error("secret stack detail");
      },
    };
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const broken = startServer({ service: failing, token: TOKEN, port: 0, uiDir: null });
    const headers = { "content-type": "application/json", origin: broken.url };
    const paired = await fetch(`${broken.url}/api/pair`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: TOKEN }),
    });
    const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
    const res = await fetch(`${broken.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify({ method: "listProjects" }),
    });
    broken.stop();
    quiet.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: { code: "INTERNAL", message: "internal error" } });
  });
});

describe("agents routes", () => {
  const RUN = crypto.randomUUID();
  const hookTo = (url: string, runId: string, headers: Record<string, string>) =>
    fetch(`${url}/hooks/${runId}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({
        payload: {
          event: "Stop",
          sessionId: "s",
          transcriptPath: null,
          tool: null,
          detail: null,
          question: null,
          agentId: null,
        },
        toolInput: null,
      }),
    });

  test("hook posts skip the session but need the run token and a local Host", async () => {
    expect((await hookTo(server.url, RUN, {})).status).toBe(404);
    const foreign = await hookTo(server.url, RUN, {
      authorization: `Bearer ${"b".repeat(64)}`,
      host: "evil.test",
    });
    expect(foreign.status).toBe(403);
  });

  test("hook posts reach the sink only with the right run token", async () => {
    const received: string[] = [];
    const sink: HookSink = {
      verify: (runId, token) => runId === RUN && token === "b".repeat(64),
      receive: (runId, payload) => {
        received.push(`${runId}:${payload.event}`);
        return null;
      },
    };
    const hooked = startServer({
      service: createService(store, { user: "adam" }),
      token: TOKEN,
      port: 0,
      uiDir: null,
      hooks: sink,
    });
    const bearer = { authorization: `Bearer ${"b".repeat(64)}` };
    const wrong = await hookTo(hooked.url, RUN, { authorization: `Bearer ${"0".repeat(64)}` });
    const foreign = await hookTo(hooked.url, RUN, { ...bearer, host: "evil.test" });
    const ok = await hookTo(hooked.url, RUN, bearer);
    const notUuid = await hookTo(hooked.url, "not-a-run", bearer);
    hooked.stop();
    expect(wrong.status).toBe(401);
    expect(foreign.status).toBe(403);
    expect(ok.status).toBe(204);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(notUuid.status).toBe(404);
    expect(received).toEqual([`${RUN}:Stop`]);
  });

  test("domain errors answer their HTTP status", async () => {
    const cases = [
      ["PROFILE_IN_USE", 409],
      ["INVALID_TRANSITION", 409],
      ["GIT_PUSHED", 409],
      ["PATH_OUTSIDE_PROJECT", 403],
      ["TOO_LARGE", 413],
    ] as const;
    for (const [code, status] of cases) {
      const conflicting: Service = {
        ...createService(store, { user: "adam" }),
        handle: () => {
          throw new KiboError(code, "conflict");
        },
      };
      const srv = startServer({ service: conflicting, token: TOKEN, port: 0, uiDir: null });
      const headers = { "content-type": "application/json", origin: srv.url };
      const paired = await fetch(`${srv.url}/api/pair`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token: TOKEN }),
      });
      const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
      const res = await fetch(`${srv.url}/api/rpc`, {
        method: "POST",
        headers: { ...headers, cookie },
        body: JSON.stringify({ method: "cancelRun", runId: "r1" }),
      });
      srv.stop();
      expect(res.status).toBe(status);
      expect(await res.json()).toMatchObject({ ok: false, error: { code } });
    }
  });
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
          "font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
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

test("the pairing token is created once, private to the user", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-token-"));
  const t1 = loadOrCreateToken(dir);
  expect(t1).toMatch(/^[0-9a-f]{64}$/);
  expect(loadOrCreateToken(dir)).toBe(t1);
  expect(statSync(join(dir, "token")).mode & 0o777).toBe(0o600);
  rmSync(dir, { recursive: true, force: true });
});
