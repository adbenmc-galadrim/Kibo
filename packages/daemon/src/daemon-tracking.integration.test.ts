import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import type { RpcRequest } from "@kibo/schema";
import { z } from "zod";
import { fakeBuild, okReport } from "./components/service.test-helper";
import { startDaemon } from "./daemon";

const FIXED_NOW = "2026-10-16T14:52:00+02:00";
const Answer = z.object({ result: z.unknown() });
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).reverse()) await clean();
});

async function launch() {
  const home = mkdtempSync(join(tmpdir(), "kibo-tracking-start-"));
  const previous = process.env.KIBO_FIXED_NOW;
  process.env.KIBO_FIXED_NOW = FIXED_NOW;
  const started = startDaemon({
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    build: fakeBuild,
    validate: okReport,
    home,
  });
  const d = await started.finally(() => {
    if (previous === undefined) delete process.env.KIBO_FIXED_NOW;
    else process.env.KIBO_FIXED_NOW = previous;
  });
  cleanups.push(async () => {
    await d.stop();
    rmSync(home, { recursive: true, force: true });
  });
  const paired = await fetch(`${d.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: d.url },
    body: JSON.stringify({ token: d.token }),
  });
  const cookie = paired.headers.get("set-cookie")?.split(";")[0] ?? "";
  return async (req: RpcRequest): Promise<unknown> => {
    const res = await fetch(`${d.url}/api/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: d.url, cookie },
      body: JSON.stringify(req),
    });
    return Answer.parse(await res.json()).result;
  };
}

test("a daemon started with KIBO_FIXED_NOW reports it and hides agent execution by default", async () => {
  const rpc = await launch();
  expect(await rpc({ method: "getAppInfo" })).toMatchObject({ fixedNow: FIXED_NOW });
  expect(await rpc({ method: "getAppSettings" })).toEqual({ agentExecution: "hidden" });
  expect(await rpc({ method: "setAppSettings", patch: { agentExecution: "shown" } })).toEqual({
    agentExecution: "shown",
  });
});
