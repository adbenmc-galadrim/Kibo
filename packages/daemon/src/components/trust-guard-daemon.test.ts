import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { RpcRequest } from "@kibo/schema";
import { type Daemon, startDaemon } from "../daemon";
import { freePort } from "../remote/remote.test-helper";
import { fakeBuild, okReport } from "./service.test-helper";

let home: string;
let daemon: Daemon;
let remotePort: number;
let remoteUrl: string;

beforeEach(async () => {
  remotePort = freePort();
  remoteUrl = `https://127.0.0.1:${remotePort}`;
  home = mkdtempSync(join(tmpdir(), "kibo-trust-guard-"));
  daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    build: fakeBuild,
    validate: okReport,
    integrations: { testOrigins: [], memorySecrets: true },
  });
});
afterEach(async () => {
  await daemon.stop();
  rmSync(home, { recursive: true, force: true });
});

async function localRpc(cookie: string, req: RpcRequest): Promise<unknown> {
  const res = await fetch(`${daemon.url}/api/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url, cookie },
    body: JSON.stringify(req),
  });
  return res.json();
}

async function remoteSession(): Promise<{ cookie: string; ca: string }> {
  const paired = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url },
    body: JSON.stringify({ token: daemon.token }),
  });
  const local = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  await localRpc(local, {
    method: "enableRemoteAccess",
    address: "127.0.0.1",
    port: remotePort,
    tls: { kind: "self-signed" },
  });
  const code = (await localRpc(local, { method: "createPairingCode" })) as { result: { code: string } };
  const ca = readFileSync(join(home, "remote", "cert.pem"), "utf8");
  const res = await fetch(`${remoteUrl}/api/pair-code`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: remoteUrl },
    body: JSON.stringify({ code: code.result.code }),
    tls: { ca },
  });
  expect(res.status).toBe(204);
  return { cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "", ca };
}

test("a remote session cannot grant trust through the real dispatch", async () => {
  const { cookie, ca } = await remoteSession();
  const remoteRpc = async (req: RpcRequest) => {
    const res = await fetch(`${remoteUrl}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: remoteUrl, cookie },
      body: JSON.stringify(req),
      tls: { ca },
    });
    return res.json();
  };
  const hash = "c".repeat(64);
  const forbidden = { ok: false, error: { code: "FORBIDDEN" } };
  expect(
    await remoteRpc({ method: "approveComponent", id: "hello", version: "0.1.0", hash, trust: "sandboxed" }),
  ).toMatchObject(forbidden);
  expect(
    await remoteRpc({
      method: "finalizeComponentDraft",
      draftId: crypto.randomUUID(),
      version: "0.1.0",
      hash,
      trust: "trusted",
      strategy: "new-version",
      target: null,
    }),
  ).toMatchObject(forbidden);
  expect(await remoteRpc({ method: "listComponents" })).toMatchObject({ ok: true });
});
