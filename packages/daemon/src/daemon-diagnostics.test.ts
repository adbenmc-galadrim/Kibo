import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { AppInfo, isAppVersion, type RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { aiScenarioPath } from "./agents/fake-claude-ai";
import { FAKE_CLAUDE } from "./agents/fake-claude-scenario";
import { startDaemon } from "./daemon";
import { createRedactor, installConsoleRedaction } from "./integrations/redact";
import { createLogBuffer } from "./log-buffer";

const Envelope = z.object({ ok: z.literal(true), result: z.unknown() });
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

async function launch() {
  const home = mkdtempSync(join(tmpdir(), "kibo-diag-"));
  const fakeState = join(home, "fake");
  mkdirSync(fakeState);
  const logBuffer = createLogBuffer();
  cleanups.push(logBuffer.install(console));
  const redactor = createRedactor();
  cleanups.push(installConsoleRedaction(redactor));
  const daemon = await startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    claudeBin: FAKE_CLAUDE,
    sampler: () => ({ cpu: 5, ram: 5 }),
    agentEnv: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      KIBO_FAKE_CLAUDE_SCENARIO: aiScenarioPath("onboarding-ok.json"),
      KIBO_FAKE_CLAUDE_STATE: fakeState,
    },
    redactor,
    logBuffer,
    userHome: dirname(home),
  });
  cleanups.push(() => rmSync(home, { recursive: true, force: true }));
  cleanups.push(() => daemon.stop());
  const pair = await fetch(`${daemon.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: daemon.url },
    body: JSON.stringify({ token: daemon.token }),
  });
  const cookie = pair.headers.get("set-cookie")?.split(";")[0] ?? "";
  const rpc = async (req: RpcRequest) => {
    const res = await fetch(`${daemon.url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: daemon.url, cookie },
      body: JSON.stringify(req),
    });
    return Envelope.parse(await res.json()).result;
  };
  return { home, rpc };
}

test("getAppInfo reports the daemon pid and an abbreviated home", async () => {
  const { home, rpc } = await launch();
  const info = AppInfo.parse(await rpc({ method: "getAppInfo" }));
  expect(info.daemonPid).toBe(process.pid);
  expect(info.home).toBe(`~/${basename(home)}`);
  expect(isAppVersion(info.version)).toBe(true);
  expect(info.version).not.toBe("0.0.0");
}, 30_000);

test("getDiagnostics never contains the pairing token", async () => {
  const { home, rpc } = await launch();
  const token = readFileSync(join(home, "token"), "utf8").trim();
  console.error(`[kibo-daemon] pair failed ${token} at ${home}/x`);
  console.warn(`[kibo-daemon] cookie kibo_session=${token}`);
  const report = await rpc({ method: "getDiagnostics" });
  const json = JSON.stringify(report);
  expect(json).not.toContain(token);
  expect(json).not.toContain(home);
  expect(json).toContain(`pair failed *** at ~/${basename(home)}/x`);
  expect(report).toMatchObject({
    app: { daemonPid: process.pid },
    environment: { daemon: { home: `~/${basename(home)}` } },
    counts: { projects: expect.any(Number), profiles: 3 },
  });
}, 30_000);
