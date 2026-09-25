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
