import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bunCommand } from "./bun-command";
import { resolveToolchain } from "./toolchain";

const repo = resolve(import.meta.dir, "../../..");

test("in the monorepo the toolchain is the repository root", () => {
  expect(resolveToolchain({ env: {} }).root).toBe(repo);
});

test("an explicit toolchain must contain @kibo/sdk", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-tc-"));
  expect(() => resolveToolchain({ explicit: dir })).toThrow("NOT_FOUND");
  mkdirSync(join(dir, "node_modules", "@kibo", "sdk"), { recursive: true });
  writeFileSync(join(dir, "node_modules", "@kibo", "sdk", "package.json"), "{}");
  expect(resolveToolchain({ explicit: dir }).root).toBe(dir);
});

test("a packaged binary finds Resources/toolchain next to it", () => {
  const app = realpathSync(mkdtempSync(join(tmpdir(), "kibo-app-")));
  const macos = join(app, "Kibo.app", "Contents", "MacOS");
  const sdk = join(app, "Kibo.app", "Contents", "Resources", "toolchain", "node_modules", "@kibo", "sdk");
  mkdirSync(macos, { recursive: true });
  mkdirSync(sdk, { recursive: true });
  writeFileSync(join(sdk, "package.json"), "{}");
  writeFileSync(join(macos, "kibo-daemon"), "");
  const found = resolveToolchain({ env: {}, execPath: join(macos, "kibo-daemon"), here: "/$bunfs/root" });
  expect(found.root).toBe(join(app, "Kibo.app", "Contents", "Resources", "toolchain"));
});

test("bun is the current executable in dev and the binary itself once compiled", () => {
  expect(bunCommand({ compiled: false, execPath: "/usr/bin/bun" })).toEqual({
    argv: ["/usr/bin/bun"],
    env: {},
  });
  expect(bunCommand({ compiled: true, execPath: "/app/kibo-daemon" }).argv).toEqual(["/app/kibo-daemon"]);
});
