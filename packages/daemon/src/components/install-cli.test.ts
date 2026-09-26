import { expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installCli } from "./install-cli";

test("links ~/.local/bin/kibo to the compiled binary, idempotently", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-bin-"));
  const exe = join(dir, "kibo-daemon");
  writeFileSync(exe, "");
  const binDir = join(dir, "bin");
  expect(await installCli({ execPath: exe, binDir, compiled: true, env: {} })).toEqual({
    path: join(binDir, "kibo"),
  });
  expect(await installCli({ execPath: exe, binDir, compiled: true, env: {} })).toEqual({
    path: join(binDir, "kibo"),
  });
  expect(lstatSync(join(binDir, "kibo")).isSymbolicLink()).toBe(true);
  expect(readlinkSync(join(binDir, "kibo"))).toBe(exe);
  await expect(installCli({ execPath: exe, binDir, compiled: false, env: {} })).rejects.toThrow(
    "INVALID_INPUT",
  );
  rmSync(join(binDir, "kibo"));
  writeFileSync(join(binDir, "kibo"), "not ours");
  await expect(installCli({ execPath: exe, binDir, compiled: true, env: {} })).rejects.toThrow("CONFLICT");
  rmSync(dir, { recursive: true, force: true });
});

test("replaces a link to an older Kibo binary", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-bin-"));
  const binDir = join(dir, "bin");
  await installCli({ execPath: join(dir, "old", "kibo-daemon"), binDir, compiled: true, env: {} });
  await installCli({ execPath: join(dir, "new", "kibo-daemon"), binDir, compiled: true, env: {} });
  expect(readlinkSync(join(binDir, "kibo"))).toBe(join(dir, "new", "kibo-daemon"));
  expect(readdirSync(binDir)).toEqual(["kibo"]);
  rmSync(dir, { recursive: true, force: true });
});

test("never replaces a link owned by another tool", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-bin-"));
  const binDir = join(dir, "bin");
  mkdirSync(binDir);
  symlinkSync("/usr/bin/true", join(binDir, "kibo"));
  const exe = join(dir, "kibo-daemon");
  await expect(installCli({ execPath: exe, binDir, compiled: true, env: {} })).rejects.toThrow("CONFLICT");
  expect(readlinkSync(join(binDir, "kibo"))).toBe("/usr/bin/true");
  rmSync(dir, { recursive: true, force: true });
});

test("refuses a binary running from an AppImage mount", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-bin-"));
  const binDir = join(dir, "bin");
  const env = { APPIMAGE: "/home/adam/Kibo.AppImage" };
  const install = installCli({ execPath: "/tmp/.mount_KiboX1/kibo-daemon", binDir, compiled: true, env });
  await expect(install).rejects.toThrow("INVALID_INPUT");
  expect(existsSync(join(binDir, "kibo"))).toBe(false);
  rmSync(dir, { recursive: true, force: true });
});

test("refuses a binary running from macOS App Translocation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-bin-"));
  const binDir = join(dir, "bin");
  const execPath = "/private/var/folders/x/AppTranslocation/ABC/d/Kibo.app/Contents/MacOS/kibo-daemon";
  await expect(installCli({ execPath, binDir, compiled: true, env: {} })).rejects.toThrow("INVALID_INPUT");
  expect(existsSync(join(binDir, "kibo"))).toBe(false);
  rmSync(dir, { recursive: true, force: true });
});
