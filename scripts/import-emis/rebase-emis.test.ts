import { expect, test } from "bun:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "rebase-emis.ts");

test("--apply exits with code 2 and writes nothing until T19", async () => {
  const exportDir = mkdtempSync(join(tmpdir(), "kibo-rebase-export-"));
  const home = mkdtempSync(join(tmpdir(), "kibo-rebase-home-"));
  try {
    const proc = Bun.spawn(
      [
        "bun",
        SCRIPT,
        "--apply",
        "--plan",
        join(exportDir, "rebase-plan.json"),
        "--yes",
        "--export",
        exportDir,
        "--home",
        home,
      ],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    expect(code).toBe(2);
    expect(err).toContain("T19");
    expect(readdirSync(exportDir)).toEqual([]);
    expect(readdirSync(home)).toEqual([]);
  } finally {
    rmSync(exportDir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
