import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_TOOLCHAIN } from "@kibo/devkit/test-kit";
import { pair } from "../components/exit.test-helper";
import { okReport } from "../components/service.test-helper";
import { startDaemon } from "../daemon";

const home = mkdtempSync(join(tmpdir(), "kibo-sandbox-daemon-"));
afterAll(() => rmSync(home, { recursive: true, force: true }));
const boot = () =>
  startDaemon({
    home,
    port: 0,
    sandboxPort: 0,
    uiDir: null,
    dev: false,
    toolchain: DEV_TOOLCHAIN,
    user: "adam",
    validate: okReport,
  });

test("the daemon reports its isolation and keeps the setting across restarts", async () => {
  const first = await boot();
  try {
    const client = await pair(first);
    expect(await client.ok({ method: "getSandboxStatus" })).toMatchObject({
      kind: process.platform === "darwin" ? "sandbox-exec" : "bwrap",
      available: true,
      allowUnsandboxed: false,
    });
    await client.ok({ method: "setAllowUnsandboxed", allow: true });
  } finally {
    await first.stop();
  }
  const second = await boot();
  try {
    const client = await pair(second);
    expect(await client.ok({ method: "getSandboxStatus" })).toMatchObject({ allowUnsandboxed: true });
  } finally {
    await second.stop();
  }
}, 60_000);
