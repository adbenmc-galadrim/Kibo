import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "rebase-emis.ts");

async function refused(args: (dir: { exportDir: string; home: string }) => string[], reason: string) {
  const exportDir = mkdtempSync(join(tmpdir(), "kibo-rebase-export-"));
  const home = mkdtempSync(join(tmpdir(), "kibo-rebase-home-"));
  try {
    const proc = Bun.spawn(
      ["bun", SCRIPT, "--apply", ...args({ exportDir, home }), "--export", exportDir, "--home", home],
      { env: { ...process.env, KIBO_HOME: home }, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    expect(code).toBe(1);
    expect(err).toContain(reason);
    expect(readdirSync(exportDir)).toEqual([]);
    expect(readdirSync(home)).toEqual([]);
  } finally {
    rmSync(exportDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
}

test("--apply without a plan read back is refused before contacting the daemon", async () => {
  await refused(() => ["--yes"], "--plan");
});

test("--apply without --yes is refused", async () => {
  await refused(({ exportDir }) => ["--plan", join(exportDir, "rebase-plan.json")], "--yes");
});

test("--apply with a missing plan file is refused", async () => {
  await refused(({ exportDir }) => ["--plan", join(exportDir, "rebase-plan.json"), "--yes"], "ENOENT");
});
