import { afterAll, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileBinary, linkModules, REPO, tempDir } from "./spike-kit";

const tmp = tempDir("kibo-spike-a-");
afterAll(tmp.dispose);

test("a compiled binary behaves like bun when BUN_BE_BUN=1", async () => {
  const entry = join(tmp.dir, "main.ts");
  writeFileSync(entry, 'console.log("daemon-main");\n');
  const bin = join(tmp.dir, "kd");
  await compileBinary([entry], bin);
  expect(Bun.spawnSync([bin]).stdout.toString()).toContain("daemon-main");
  const version = Bun.spawnSync([bin, "--version"], { env: { BUN_BE_BUN: "1" } });
  expect(version.stdout.toString().trim()).toBe(Bun.version);
  const suite = join(tmp.dir, "suite");
  mkdirSync(suite);
  linkModules(suite);
  writeFileSync(
    join(suite, "a.test.ts"),
    'import { expect, test } from "bun:test";\nimport { createElement } from "react";\ntest("ok", () => expect(typeof createElement).toBe("function"));\n',
  );
  const preload = join(REPO, "packages/devkit/src/preload");
  const run = Bun.spawnSync(
    [bin, "test", "--preload", join(preload, "happydom.ts"), "--preload", join(preload, "restrict.ts")],
    { cwd: suite, env: { BUN_BE_BUN: "1" } },
  );
  expect(run.stderr.toString()).toContain("1 pass");
  expect(run.exitCode).toBe(0);
}, 120_000);
