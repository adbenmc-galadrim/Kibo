import { expect, test } from "bun:test";
import { join } from "node:path";

const run = (...args: string[]) => {
  const result = Bun.spawnSync(["bun", join(import.meta.dir, "changelog.ts"), ...args]);
  return { code: result.exitCode, out: result.stdout.toString(), err: result.stderr.toString() };
};

test("section prints the body of a published version", () => {
  const { code, out } = run("section", "1.4.0");
  expect(code).toBe(0);
  expect(out).toStartWith("- ");
  expect(out).not.toContain("## ");
});

test("section exits 1 when the version has no section", () => {
  const { code, err } = run("section", "0.0.1");
  expect(code).toBe(1);
  expect(err).toContain("CHANGELOG.md has no section for 0.0.1");
});

test("version check accepts the current version, which has a changelog section", () => {
  const version = Bun.spawnSync(["bun", join(import.meta.dir, "version.ts"), "get"])
    .stdout.toString()
    .trim();
  const result = Bun.spawnSync(["bun", join(import.meta.dir, "version.ts"), "check", `v${version}`]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain(`tag v${version} matches version ${version}`);
});
