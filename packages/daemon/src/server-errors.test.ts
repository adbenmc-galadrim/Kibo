import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { startServer } from "./server";
import { createService, type Service } from "./service";
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

describe("integration errors", () => {
  test("a remote error keeps its status and loses its secret", async () => {
    const secret = "ghp_TESTSECRET0123456789abcdefghijklmn";
    const failing: Service = {
      ...createService(store, { user: "adam" }),
      handle: () => {
        throw new KiboError("REMOTE_REJECTED", `github 401: Bearer ${secret}`);
      },
    };
    const redacting = startServer({
      service: failing,
      token: TOKEN,
      port: 0,
      uiDir: null,
      redact: (text) => text.split(secret).join("***"),
    });
    const headers = { "content-type": "application/json", origin: redacting.url };
    const paired = await fetch(`${redacting.url}/api/pair`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: TOKEN }),
    });
    const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
    const res = await fetch(`${redacting.url}/api/rpc`, {
      method: "POST",
      headers: { ...headers, cookie },
      body: JSON.stringify({ method: "listIntegrations" }),
    });
    redacting.stop();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: "REMOTE_REJECTED", message: "github 401: Bearer ***" },
    });
  });
});

describe("domain errors", () => {
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
