import { afterEach, expect, spyOn, test } from "bun:test";
import { tmpdir } from "node:os";
import { runBounded } from "./bounded-process";

afterEach(() => {
  spyOn(process, "kill").mockRestore();
  spyOn(console, "error").mockRestore();
});

test("a timeout whose kill fails still resolves as timed out", async () => {
  const realKill = process.kill.bind(process);
  spyOn(process, "kill").mockImplementation((pid: number, signal?: string | number) => {
    realKill(pid, signal);
    throw Object.assign(new Error("kill() failed: EINVAL"), { code: "EINVAL" });
  });
  const log = spyOn(console, "error").mockImplementation(() => {});
  const res = await runBounded(["sleep", "5"], { cwd: tmpdir(), env: process.env, timeoutMs: 50 });
  expect(res.timedOut).toBe(true);
  expect(log).toHaveBeenCalled();
});
