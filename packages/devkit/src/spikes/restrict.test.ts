import { afterAll, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { linkModules, REPO, tempDir } from "./spike-kit";

const tmp = tempDir("kibo-spike-b-");
afterAll(tmp.dispose);

const SUITE = `import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";

test("capabilities are gone", () => {
  expect(globalThis.fetch).toBeUndefined();
  expect(globalThis.WebSocket).toBeUndefined();
  expect(Bun.spawn).toBeUndefined();
  expect(Bun.file).toBeUndefined();
  expect(Bun.write).toBeUndefined();
  expect(process.binding).toBeUndefined();
  expect(process.getBuiltinModule).toBeUndefined();
});

test("the DOM still works", () => {
  render(createElement("p", null, "ok"));
  expect(screen.getByText("ok")).toBeTruthy();
});

test("KNOWN LIMIT E2: a constructed dynamic import is not blocked", async () => {
  const load = new Function("s", "return import(s)");
  await expect(load("node:fs")).resolves.toBeDefined();
});
`;

test("bun test runs a suite with happy-dom then restrict preloaded", () => {
  linkModules(tmp.dir);
  writeFileSync(join(tmp.dir, "suite.test.ts"), SUITE);
  const preload = join(REPO, "packages/devkit/src/preload");
  const run = Bun.spawnSync(
    [
      process.execPath,
      "test",
      "--preload",
      join(preload, "happydom.ts"),
      "--preload",
      join(preload, "restrict.ts"),
    ],
    { cwd: tmp.dir, env: { HOME: tmp.dir, TMPDIR: tmp.dir } },
  );
  const output = run.stderr.toString();
  expect(output).toContain("3 pass");
  expect(run.exitCode).toBe(0);
}, 60_000);
