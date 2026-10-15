import { describe, expect, test } from "bun:test";
import { DEFAULT_DUPLICATION_SETTINGS, DUPLICATION_SHARED_GLOBS } from "@kibo/schema";
import { globToRegExp, isCodePath, isIgnoredPath, isSecretPath, isSharedPath, isTestPath } from "./ignore";

const settings = DEFAULT_DUPLICATION_SETTINGS;

describe("globToRegExp", () => {
  test("a basename glob matches at any depth", () => {
    const re = globToRegExp("*.lock");
    expect(re.test("bun.lock")).toBe(true);
    expect(re.test("a/b.lock")).toBe(true);
    expect(re.test("lock")).toBe(false);
  });

  test("a folder glob matches the folder at any depth", () => {
    const re = globToRegExp("node_modules/");
    expect(re.test("node_modules/x/y.js")).toBe(true);
    expect(re.test("a/node_modules/z")).toBe(true);
    expect(re.test("node_modules_x/y")).toBe(false);
  });

  test("a glob with a slash is anchored at the root", () => {
    const re = globToRegExp("src/generated/**");
    expect(re.test("src/generated/a/b.ts")).toBe(true);
    expect(re.test("src/gen/a.ts")).toBe(false);
    expect(re.test("x/src/generated/a.ts")).toBe(false);
    expect(globToRegExp("/docs/*.md").test("docs/a.md")).toBe(true);
  });

  test("a question mark is one character", () => {
    const re = globToRegExp("?.ts");
    expect(re.test("a.ts")).toBe(true);
    expect(re.test("x/b.ts")).toBe(true);
    expect(re.test("ab.ts")).toBe(false);
  });

  test("regular expression characters are literal", () => {
    expect(globToRegExp("a+b.ts").test("a+b.ts")).toBe(true);
    expect(globToRegExp("a+b.ts").test("aab.ts")).toBe(false);
  });
});

describe("isIgnoredPath", () => {
  test.each([
    "dist/a.js",
    "bun.lock",
    "a.min.js",
    "x.generated.ts",
    "img.png",
    "IMG.PNG",
    ".env.local",
    "a/.env",
  ])("%p is ignored", (path) => {
    expect(isIgnoredPath(path, settings)).toBe(true);
  });

  test("source code is kept", () => {
    expect(isIgnoredPath("src/a.ts", settings)).toBe(false);
  });

  test("tests are not ignored paths", () => {
    expect(isIgnoredPath("a.test.ts", settings)).toBe(false);
    expect(isIgnoredPath("fixtures/x.json", settings)).toBe(false);
  });

  test("project globs are added", () => {
    expect(isIgnoredPath("docs/a.md", { ignore: ["docs/**"] })).toBe(true);
    expect(isIgnoredPath("src/docs/a.md", { ignore: ["docs/**"] })).toBe(false);
  });
});

describe("path kinds", () => {
  test("test paths", () => {
    for (const path of [
      "a.test.ts",
      "__tests__/a.ts",
      "fixtures/x.json",
      "a.stories.tsx",
      "b.spec.js",
      "x.fixture.ts",
    ]) {
      expect(isTestPath(path)).toBe(true);
    }
    expect(isTestPath("src/a.ts")).toBe(false);
  });

  test("secret paths", () => {
    expect(isSecretPath("id_rsa.pub")).toBe(true);
    expect(isSecretPath("keys/x.pem")).toBe(true);
    expect(isSecretPath(".env")).toBe(true);
    expect(isSecretPath("src/env.ts")).toBe(false);
  });

  test("code paths", () => {
    expect(isCodePath("a.tsx")).toBe(true);
    expect(isCodePath("lib/a.MJS")).toBe(true);
    expect(isCodePath("a.py")).toBe(false);
    expect(isCodePath("Makefile")).toBe(false);
  });
});

describe("isSharedPath", () => {
  const shared = { shared: DUPLICATION_SHARED_GLOBS };

  test("i18n, configs and generated files are shared by nature", () => {
    expect(isSharedPath("packages/i18n/src/locales/fr.ts", shared)).toBe(true);
    expect(isSharedPath("turbo.json", shared)).toBe(true);
    expect(isSharedPath("apps/web/src/app/routeTree.gen.ts", shared)).toBe(true);
  });

  test("ordinary code is not shared", () => {
    expect(isSharedPath("src/lib/format.ts", shared)).toBe(false);
  });

  test("the project list replaces the default one", () => {
    expect(isSharedPath("turbo.json", { shared: ["docs/**"] })).toBe(false);
    expect(isSharedPath("docs/a.ts", { shared: ["docs/**"] })).toBe(true);
  });
});
