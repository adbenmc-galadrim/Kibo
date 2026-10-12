import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { writeAtomically } from "./atomic-write";
import { tempDir } from "./test-home.test-helper";

test("the content is written with the requested mode, creating the folder", async () => {
  const dir = join(tempDir("kibo-atomic-"), "agents");
  const path = join(dir, "a.md");
  await writeAtomically(path, "bonjour", 0o644);
  expect(readFileSync(path, "utf8")).toBe("bonjour");
  expect(statSync(path).mode & 0o777).toBe(0o644);
  expect(readdirSync(dir)).toEqual(["a.md"]);
});

test("concurrent writes leave one whole content, never a truncated one", async () => {
  const dir = tempDir("kibo-atomic-");
  const path = join(dir, "a.md");
  const contents = Array.from({ length: 50 }, (_, i) => `${i}:`.padEnd(20_000, String(i % 10)));
  await Promise.all(contents.map((c) => writeAtomically(path, c, 0o644)));
  expect(contents).toContain(readFileSync(path, "utf8"));
  expect(readdirSync(dir)).toEqual(["a.md"]);
});
