import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isAlive, recordedPid, smokeCommand } from "./smoke-check";

test("the recorded pid comes from daemon.json, or nothing when the daemon cleaned up", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-smoke-"));
  expect(recordedPid(home)).toBeNull();
  writeFileSync(join(home, "daemon.json"), JSON.stringify({ port: 1, sandboxPort: 2, pid: 4242 }));
  expect(recordedPid(home)).toBe(4242);
  writeFileSync(join(home, "daemon.json"), "{broken");
  expect(recordedPid(home)).toBeNull();
  rmSync(home, { recursive: true, force: true });
});

test("a live pid is alive, a dead one is not", () => {
  expect(isAlive(process.pid)).toBe(true);
  const gone = Bun.spawnSync(["true"]).pid;
  expect(isAlive(gone)).toBe(false);
});

test("the shell runs under xvfb on linux only", () => {
  expect(smokeCommand("/bin/kibo", "linux")).toEqual(["xvfb-run", "-a", "/bin/kibo"]);
  expect(smokeCommand("/bin/kibo", "darwin")).toEqual(["/bin/kibo"]);
});
