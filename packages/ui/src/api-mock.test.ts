import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { apiMock } from "./api-mock";

const realApi = "./api?real";

test("an api mock exposes every export of the real api module", async () => {
  const real: object = await import(realApi);
  expect(Object.keys(apiMock({ client: {} })).sort()).toEqual(Object.keys(real).sort());
});

test("every test that mocks the api module builds its mock with apiMock", () => {
  const mockOfApi = /mock\.module\("(?:\.\/|(?:\.\.\/)+)api",\s*\(\)\s*=>\s*(\S+)/g;
  const offenders = [...new Bun.Glob("**/*.test.{ts,tsx}").scanSync(import.meta.dir)].filter((file) =>
    [...readFileSync(join(import.meta.dir, file), "utf8").matchAll(mockOfApi)].some(
      ([, factory]) => !factory?.startsWith("apiMock("),
    ),
  );
  expect(offenders).toEqual([]);
});
