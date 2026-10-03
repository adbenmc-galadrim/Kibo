import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { cleanUpSmokeHome, isAlive, recordedPid, smokeCommand } from "./smoke-check";

const root = resolve(import.meta.dir, "../../..");
const binary = join(root, "apps/desktop/src-tauri/target/debug/kibo");
const SMOKE_TIMEOUT_MS = 90_000;
const SURVIVOR_GRACE_MS = 5_000;

function report(failure: string | null, started: number): void {
  if (failure === null) {
    process.stdout.write(`[desktop-smoke] ok in ${Date.now() - started} ms\n`);
    return;
  }
  process.stderr.write(`[desktop-smoke] ${failure}\n`);
  process.exitCode = 1;
}

function buildShell(): string | null {
  if (existsSync(binary) && process.env.KIBO_SMOKE_REBUILD !== "1") return null;
  const build = Bun.spawnSync(["bun", "run", "--cwd", "apps/desktop", "build:debug"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, CARGO_TARGET_DIR: join(root, "apps/desktop/src-tauri/target") },
  });
  return build.exitCode === 0 ? null : `build:debug exited with ${build.exitCode}`;
}

async function runShell(home: string, started: number): Promise<string | null> {
  const shell = Bun.spawnSync(smokeCommand(binary, process.platform), {
    cwd: root,
    env: { ...process.env, KIBO_SMOKE: "1", KIBO_HOME: home, WEBKIT_DISABLE_DMABUF_RENDERER: "1" },
    stdout: "inherit",
    stderr: "inherit",
    timeout: SMOKE_TIMEOUT_MS,
  });
  if (shell.exitCode !== 0) return `the shell exited with ${shell.exitCode} after ${Date.now() - started} ms`;
  const pid = recordedPid(home);
  const deadline = Date.now() + SURVIVOR_GRACE_MS;
  while (pid !== null && isAlive(pid) && Date.now() < deadline) await Bun.sleep(100);
  return pid !== null && isAlive(pid) ? `the daemon ${pid} survived the shell` : null;
}

const buildFailure = buildShell();
if (buildFailure !== null) {
  report(buildFailure, Date.now());
} else {
  const home = mkdtempSync(join(tmpdir(), "kibo-smoke-home-"));
  const started = Date.now();
  try {
    report(await runShell(home, started), started);
  } finally {
    const killed = cleanUpSmokeHome(home);
    if (killed !== null) process.stderr.write(`[desktop-smoke] killed the surviving daemon ${killed}\n`);
  }
}
