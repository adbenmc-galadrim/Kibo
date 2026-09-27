import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError, type KiboErrorCode } from "@kibo/schema";
import { type CodeService, createCodeService } from "./code/code-service";
import {
  createGitFixture,
  type GitFixture,
  installFakeBin,
  readFakeBinLog,
} from "./code/testing/git-fixture";
import { createMemorySecretStore } from "./integrations/memory-secret-store";
import { createRedactor } from "./integrations/redact";
import { PairingCodes } from "./remote/pairing-codes";
import {
  enableSelfSigned,
  freePort,
  makeRemote,
  remoteCookie,
  remotePost,
} from "./remote/remote.test-helper";
import { startServer } from "./server";
import { call, createService, type Service } from "./service";
import { openStore, type Store } from "./store";

const TOKEN = "a".repeat(64);
let fx: GitFixture;
let home: string;
let store: Store;
let service: Service;
let code: CodeService;
let server: ReturnType<typeof startServer>;
let projectId: string;

beforeEach(() => {
  fx = createGitFixture({ remote: false });
  fx.commit("chore: init", { "README.md": "# kibo\n" });
  home = mkdtempSync(join(tmpdir(), "kibo-code-srv-"));
  store = openStore(home);
  service = createService(store, { user: "adam" });
  code = createCodeService(service, { env: fx.env, prPollMs: 0 });
  server = startServer({ service, code, token: TOKEN, port: 0, uiDir: null });
  projectId = call(service, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: fx.repo,
    color: "#F97316",
  }).id;
});
afterEach(() => {
  server.stop();
  code.stop();
  store.close();
  rmSync(home, { recursive: true, force: true });
  fx.cleanup();
});

const send = (url: string, body: unknown, headers: Record<string, string>) =>
  fetch(`${url}/api/code`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: url, ...headers },
    body: JSON.stringify(body),
  });
const pair = async (url: string) => {
  const res = await fetch(`${url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: url },
    body: JSON.stringify({ token: TOKEN }),
  });
  return (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
};

describe("/api/code", () => {
  test("requires a session, a known origin and host, validates the body", async () => {
    expect((await send(server.url, { method: "worktrees", projectId }, {})).status).toBe(401);
    const cookie = await pair(server.url);
    const evil = await send(
      server.url,
      { method: "worktrees", projectId },
      { cookie, origin: "http://evil.test" },
    );
    expect(evil.status).toBe(403);
    const host = await send(server.url, { method: "worktrees", projectId }, { cookie, host: "evil.test" });
    expect(host.status).toBe(403);
    expect((await send(server.url, { method: "status", projectId }, { cookie })).status).toBe(400);
    const ok = await send(server.url, { method: "status", projectId, worktree: fx.repo }, { cookie });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { result: { branch: string } }).result.branch).toBe("main");
  });

  test("paths outside the worktree are forbidden, stale edits conflict", async () => {
    const cookie = await pair(server.url);
    const outside = await send(
      server.url,
      { method: "readFile", projectId, worktree: fx.repo, path: ".git/config", revision: "worktree" },
      { cookie },
    );
    expect(outside.status).toBe(403);
    const elsewhere = await send(server.url, { method: "status", projectId, worktree: fx.dir }, { cookie });
    expect(elsewhere.status).toBe(403);
    const stale = await send(
      server.url,
      {
        method: "writeFile",
        projectId,
        worktree: fx.repo,
        path: "README.md",
        content: "x",
        baseHash: "0".repeat(40),
      },
      { cookie },
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ ok: false, error: { code: "FILE_CHANGED" } });
  });

  test("code events reach the WebSocket", async () => {
    const cookie = await pair(server.url);
    const ws = new WebSocket(`${server.url.replace("http", "ws")}/api/events`, {
      headers: { origin: server.url, cookie },
    });
    await new Promise((r) => {
      ws.onopen = r;
    });
    const message = new Promise<string>((r) => {
      ws.onmessage = (e) => r(String(e.data));
    });
    fx.write("README.md", "# edit\n");
    await send(
      server.url,
      { method: "stageFiles", projectId, worktree: fx.repo, paths: ["README.md"] },
      { cookie },
    );
    expect(JSON.parse(await message)).toEqual({ type: "code", projectId, worktree: fx.repo });
    ws.close();
  });
});

describe("/api/code from a remote session", () => {
  test("openInEditor over the remote listener answers 403 and launches nothing", async () => {
    const editor = installFakeBin(fx.dir, "code");
    const guarded = createCodeService(service, {
      env: { ...fx.env, VISUAL: editor.path, FAKE_BIN_LOG: editor.log },
      prPollMs: 0,
    });
    const codes = new PairingCodes(Date.now);
    const secrets = createMemorySecretStore(createRedactor());
    const remoteServer = startServer({
      service,
      code: guarded,
      pairingCodes: codes,
      token: TOKEN,
      port: 0,
      uiDir: null,
    });
    const f = {
      home,
      store,
      codes,
      secrets,
      server: remoteServer,
      port: freePort(),
      remote: makeRemote({ home, store, secrets, server: remoteServer }),
    };
    try {
      await enableSelfSigned(f);
      const cookie = await remoteCookie(f);
      const req = { method: "openInEditor", projectId, worktree: fx.repo, path: "README.md", line: null };
      const res = await remotePost(f, "/api/code", req, { cookie });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(readFakeBinLog(editor.log)).toEqual([]);
    } finally {
      f.remote.stop();
      remoteServer.stop();
      guarded.stop();
    }
  });
});

describe("/api/code errors", () => {
  const failingWith = async (error: unknown) => {
    const failing: CodeService = {
      handle: () => Promise.reject(error),
      onChange: () => () => {},
      stop() {},
    };
    const broken = startServer({ service, code: failing, token: TOKEN, port: 0, uiDir: null });
    try {
      const cookie = await pair(broken.url);
      const res = await send(broken.url, { method: "worktrees", projectId }, { cookie });
      return { status: res.status, body: await res.json() };
    } finally {
      broken.stop();
    }
  };

  test.each([
    ["GIT_BUSY", 409],
    ["GIT_STALE", 409],
    ["GIT_PUSHED", 409],
    ["TOO_LARGE", 413],
    ["GH_FAILED", 502],
    ["GH_UNAVAILABLE", 502],
    ["GIT_FAILED", 400],
  ] satisfies [KiboErrorCode, number][])("%s maps to HTTP %d with its detail", async (errorCode, status) => {
    const res = await failingWith(new KiboError(errorCode, "git says no"));
    expect(res).toEqual({ status, body: { ok: false, error: { code: errorCode, message: "git says no" } } });
  });

  test("internal errors never leak their details", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const error of [new Error("secret stack"), new KiboError("INTERNAL", "secret state")]) {
        expect(await failingWith(error)).toEqual({
          status: 500,
          body: { ok: false, error: { code: "INTERNAL", message: "internal error" } },
        });
      }
    } finally {
      quiet.mockRestore();
    }
  });
});
