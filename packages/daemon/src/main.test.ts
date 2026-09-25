import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("announces readiness with the pairing link on stdout only", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const proc = Bun.spawn(["bun", join(import.meta.dir, "main.ts"), "--port", "0"], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
    stderr: "pipe",
  });
  const reader = proc.stdout.getReader();
  let out = "";
  while (!out.includes("\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    out += new TextDecoder().decode(value);
  }
  proc.kill("SIGTERM");
  const code = await proc.exited;
  const err = await new Response(proc.stderr).text();
  const token = readFileSync(join(home, "token"), "utf8").trim();
  rmSync(home, { recursive: true, force: true });
  expect(out).toMatch(new RegExp(`^KIBO_READY http://127\\.0\\.0\\.1:\\d+/#pair=${token}\\n$`));
  expect(err).not.toContain("KIBO_READY");
  expect(code).toBe(0);
});

test("stops when its parent process disappears", async () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-main-"));
  const parentScript = `
    const daemon = Bun.spawn(["bun", ${JSON.stringify(join(import.meta.dir, "main.ts"))}, "--port", "0"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const reader = daemon.stdout.getReader();
    let out = "";
    while (!out.includes("\\n")) {
      const { value, done } = await reader.read();
      if (done) break;
      out += new TextDecoder().decode(value);
    }
    process.stdout.write(String(daemon.pid));
    process.exit(0);
  `;
  const parent = Bun.spawn(["bun", "-e", parentScript], {
    env: { ...process.env, KIBO_HOME: home },
    stdout: "pipe",
  });
  const pid = Number(await new Response(parent.stdout).text());
  await parent.exited;
  const alive = () => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const deadline = Date.now() + 5000;
  while (alive() && Date.now() < deadline) await Bun.sleep(100);
  const stillAlive = alive();
  if (stillAlive) process.kill(pid, "SIGKILL");
  rmSync(home, { recursive: true, force: true });
  expect(pid).toBeGreaterThan(0);
  expect(stillAlive).toBe(false);
}, 10000);
