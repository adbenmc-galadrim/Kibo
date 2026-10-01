import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FR_DEVKIT } from "./fr";
import { runStaticCheck } from "./static-check-run";
import { DEV_TOOLCHAIN } from "./test-kit";

const base = mkdtempSync(join(tmpdir(), "kibo-static-check-"));
const copy = join(base, "fake");
mkdirSync(copy);
afterAll(() => rmSync(base, { recursive: true, force: true }));

const fakeBun = (code: string) => ({ argv: [process.execPath, "-e", code], env: {} });

function checkersAlive(): number[] {
  const out = Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid=,stat=,command="]).stdout.toString();
  return out
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([, ppid, stat, ...command]) => {
      const child = Number(ppid) === process.pid && !stat?.startsWith("Z");
      return child && command.join(" ").includes(copy);
    })
    .map(([pid]) => Number(pid));
}

test("a type checker that never ends is killed and fails the typecheck step", async () => {
  const started = Date.now();
  const result = await runStaticCheck(copy, [], {
    toolchain: DEV_TOOLCHAIN,
    bun: fakeBun("await new Promise(() => setInterval(() => undefined, 1_000))"),
    timeoutMs: 1_000,
  });
  expect(Date.now() - started).toBeLessThan(3_000);
  expect(result).toEqual({
    imports: [],
    typecheck: [FR_DEVKIT.timeout(1)],
    inference: { used: [], issues: [] },
  });
  expect(checkersAlive()).toEqual([]);
}, 10_000);

test("a type checker that exits with an error rejects with its output", async () => {
  const run = runStaticCheck(copy, [], {
    toolchain: DEV_TOOLCHAIN,
    bun: fakeBun("console.error('boom'); process.exit(3)"),
  });
  await expect(run).rejects.toMatchObject({ code: "INTERNAL", detail: "static check exited with 3: boom\n" });
}, 10_000);

test("a type checker that prints an invalid report rejects", async () => {
  for (const output of ["not json", JSON.stringify({ imports: [] })]) {
    const run = runStaticCheck(copy, [], {
      toolchain: DEV_TOOLCHAIN,
      bun: fakeBun(`process.stdout.write(${JSON.stringify(output)})`),
    });
    await expect(run).rejects.toMatchObject({
      code: "INTERNAL",
      detail: "static check returned an invalid report",
    });
  }
}, 10_000);
