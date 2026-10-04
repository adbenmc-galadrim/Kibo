import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const sources = readdirSync(import.meta.dir)
  .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
  .map((name) => ({ name, text: readFileSync(join(import.meta.dir, name), "utf8") }));

test("the schema package declares no side effects", () => {
  const pkg: unknown = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));
  expect(pkg).toMatchObject({ sideEffects: false });
});

test("no schema module relies on a side effect", () => {
  const offenders = sources
    .filter(
      ({ text }) =>
        /^import\s+["']/m.test(text) || text.includes("setErrorMap") || text.includes("globalThis"),
    )
    .map(({ name }) => name);
  expect(sources.length).toBeGreaterThan(0);
  expect(offenders).toEqual([]);
});
