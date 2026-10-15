import { expect, test } from "bun:test";
import {
  DEFAULT_DUPLICATION_SETTINGS,
  DUPLICATION_SHARED_GLOBS,
  DuplicationSettings,
} from "./overlap-settings";

const BASE = { enabled: true, minLines: 8, compareTests: false, ignore: [], genericExports: [] };

test("files shared by nature are a bounded list of globs", () => {
  expect(DuplicationSettings.parse({ ...BASE, shared: ["docs/**"] }).shared).toEqual(["docs/**"]);
  const many = Array.from({ length: 51 }, (_, i) => `d${i}/**`);
  expect(DuplicationSettings.safeParse({ ...BASE, shared: many }).success).toBe(false);
  expect(DuplicationSettings.parse(BASE).shared).toBeUndefined();
});

test("the default shared files cover docs, configs, i18n and generated files", () => {
  for (const glob of [
    "*.md",
    "package.json",
    "turbo.json",
    "**/i18n/**",
    "**/locales/**",
    "routeTree.gen.ts",
  ]) {
    expect(DUPLICATION_SHARED_GLOBS).toContain(glob);
  }
  expect(DUPLICATION_SHARED_GLOBS.length).toBeLessThanOrEqual(50);
  expect(DEFAULT_DUPLICATION_SETTINGS.shared).toEqual([...DUPLICATION_SHARED_GLOBS]);
});
