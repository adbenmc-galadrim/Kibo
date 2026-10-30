import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { smokeHomeEnv } from "./smoke-check";

const root = resolve(import.meta.dir, "../../..");
const work = mkdtempSync(join(tmpdir(), "kibo-cli-smoke-"));
const bin = join(work, "kibo-daemon");
const home = join(work, "home");
const env = { ...process.env, ...smokeHomeEnv(home), KIBO_TOOLCHAIN: undefined };

function run(cmd: string[], expectedExit = 0): string {
  const p = Bun.spawnSync(cmd, { cwd: work, env, stdout: "pipe", stderr: "inherit", timeout: 300_000 });
  const out = p.stdout.toString();
  process.stdout.write(out);
  if (p.exitCode !== expectedExit) throw new Error(`${cmd.join(" ")} exited with ${p.exitCode}`);
  return out;
}

try {
  run(["bun", join(root, "apps/desktop/scripts/build-sidecar.ts"), "--out", bin]);
  mkdirSync(join(work, "bin"));
  const kibo = join(work, "bin", "kibo");
  symlinkSync(bin, kibo);
  run([kibo], 2);
  const help = run([kibo, "--help"]);
  if (!help.includes("kibo tickets list")) throw new Error("kibo --help does not list the tickets commands");
  console.log("cli smoke: ok");
} finally {
  rmSync(work, { recursive: true, force: true });
}
