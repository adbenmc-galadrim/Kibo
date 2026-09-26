import { expect, test } from "bun:test";
import { lstatSync, mkdtempSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installCli } from "./install-cli";

test("links ~/.local/bin/kibo to the compiled binary, idempotently", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-bin-"));
  const exe = join(dir, "kibo-daemon");
  writeFileSync(exe, "");
  const binDir = join(dir, "bin");
  expect(await installCli({ execPath: exe, binDir, compiled: true })).toEqual({ path: join(binDir, "kibo") });
  expect(await installCli({ execPath: exe, binDir, compiled: true })).toEqual({ path: join(binDir, "kibo") });
  expect(lstatSync(join(binDir, "kibo")).isSymbolicLink()).toBe(true);
  expect(readlinkSync(join(binDir, "kibo"))).toBe(exe);
  await expect(installCli({ execPath: exe, binDir, compiled: false })).rejects.toThrow("INVALID_INPUT");
  rmSync(join(binDir, "kibo"));
  writeFileSync(join(binDir, "kibo"), "not ours");
  await expect(installCli({ execPath: exe, binDir, compiled: true })).rejects.toThrow("CONFLICT");
  rmSync(dir, { recursive: true, force: true });
});

test("replaces a link to an older Kibo binary", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-bin-"));
  const binDir = join(dir, "bin");
  await installCli({ execPath: join(dir, "old"), binDir, compiled: true });
  await installCli({ execPath: join(dir, "new"), binDir, compiled: true });
  expect(readlinkSync(join(binDir, "kibo"))).toBe(join(dir, "new"));
  rmSync(dir, { recursive: true, force: true });
});
