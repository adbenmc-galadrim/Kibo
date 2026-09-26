import { expect, test } from "bun:test";
import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { copyFixture, REPO } from "./test-kit";

test("copyFixture copies outside the repo, strips .fixture and links node_modules", () => {
  const { dir, dispose } = copyFixture("hello");
  expect(dir.startsWith(REPO)).toBe(false);
  expect(existsSync(join(dir, "component.test.tsx"))).toBe(true);
  expect(existsSync(join(dir, "component.test.tsx.fixture"))).toBe(false);
  expect(lstatSync(join(dir, "node_modules")).isSymbolicLink()).toBe(true);
  dispose();
  expect(existsSync(dir)).toBe(false);
});
