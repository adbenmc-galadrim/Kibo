import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExecPort } from "./exec";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("createExecPort", () => {
  test("runs a binary with the given environment", async () => {
    const exec = createExecPort({ PATH: process.env.PATH, KIBO_PROBE: "yes" });
    const r = await exec(["sh", "-c", "echo $KIBO_PROBE"], 10_000);
    expect(r).toEqual({ code: 0, stdout: "yes\n", stderr: "" });
  });
  test("returns null for a missing binary", async () => {
    expect(await createExecPort(process.env)(["kibo-definitely-missing-binary"], 1_000)).toBeNull();
    expect(await createExecPort(process.env)(["/nonexistent/claude", "--version"], 1_000)).toBeNull();
  });
  test("returns null for a file that cannot be executed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kibo-exec-"));
    roots.push(dir);
    writeFileSync(join(dir, "claude"), "#!/bin/sh\n", { mode: 0o644 });
    expect(await createExecPort(process.env)([join(dir, "claude"), "--version"], 1_000)).toBeNull();
  });
  test("rethrows any other launch failure", async () => {
    await expect(createExecPort(process.env)(["sh", "-c", "a\0b"], 1_000)).rejects.toMatchObject({
      code: "ERR_INVALID_ARG_VALUE",
    });
  });
});
