import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { isAlive, recordedPid, smokeCommand } from "./smoke-check";

const root = resolve(import.meta.dir, "../../..");
const binary = join(root, "apps/desktop/src-tauri/target/debug/kibo");
const SMOKE_TIMEOUT_MS = 90_000;
const SURVIVOR_GRACE_MS = 5_000;

function fail(message: string): never {
  process.stderr.write(`[desktop-smoke] ${message}\n`);
  process.exit(1);
}

if (!existsSync(binary) || process.env.KIBO_SMOKE_REBUILD === "1") {
  const build = Bun.spawnSync(["bun", "run", "--cwd", "apps/desktop", "build:debug"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, CARGO_TARGET_DIR: join(root, "apps/desktop/src-tauri/target") },
  });
  if (build.exitCode !== 0) fail(`build:debug exited with ${build.exitCode}`);
}

const home = mkdtempSync(join(tmpdir(), "kibo-smoke-home-"));
const started = Date.now();
const shell = Bun.spawnSync(smokeCommand(binary, process.platform), {
  cwd: root,
  env: { ...process.env, KIBO_SMOKE: "1", KIBO_HOME: home, WEBKIT_DISABLE_DMABUF_RENDERER: "1" },
  stdout: "inherit",
  stderr: "inherit",
  timeout: SMOKE_TIMEOUT_MS,
});
if (shell.exitCode !== 0) fail(`the shell exited with ${shell.exitCode} after ${Date.now() - started} ms`);

const pid = recordedPid(home);
const deadline = Date.now() + SURVIVOR_GRACE_MS;
while (pid !== null && isAlive(pid) && Date.now() < deadline) await Bun.sleep(100);
if (pid !== null && isAlive(pid)) fail(`the daemon ${pid} survived the shell`);
rmSync(home, { recursive: true, force: true });
process.stdout.write(`[desktop-smoke] ok in ${Date.now() - started} ms\n`);
