import { expect, test } from "bun:test";
import fc from "fast-check";
import { compareAppVersions, isAppVersion } from "./app-version";

test("only X.Y.Z and X.Y.Z-alpha.N are application versions", () => {
  for (const ok of ["1.6.0", "0.16.0-alpha.1", "0.16.0-alpha.12", "1.0.0"])
    expect(isAppVersion(ok)).toBe(true);
  for (const bad of [
    "1.6",
    "v1.6.0",
    "0.16.0-alpha",
    "0.16.0-alpha.1.2",
    "0.16.0-beta.1",
    "0.16.0-alpha.01x",
    "1.6.0 ",
  ])
    expect(isAppVersion(bad)).toBe(false);
});

test("a release beats its alphas, alphas compare by number, numbers compare numerically", () => {
  expect(compareAppVersions("0.16.0-alpha.1", "0.16.0-alpha.2")).toBe(-1);
  expect(compareAppVersions("0.16.0-alpha.2", "0.16.0")).toBe(-1);
  expect(compareAppVersions("0.16.0-alpha.10", "0.16.0-alpha.9")).toBe(1);
  expect(compareAppVersions("0.17.0-alpha.1", "0.16.0-alpha.9")).toBe(1);
  expect(compareAppVersions("1.0.0", "0.99.0-alpha.3")).toBe(1);
  expect(compareAppVersions("0.16.0-alpha.1", "1.6.0")).toBe(-1);
  expect(compareAppVersions("1.6.0", "1.6.0")).toBe(0);
  const version = fc
    .tuple(fc.nat(99), fc.nat(99), fc.nat(99), fc.option(fc.nat(99), { nil: null }))
    .map(([a, b, c, pre]) => `${a}.${b}.${c}${pre === null ? "" : `-alpha.${pre}`}`);
  fc.assert(
    fc.property(version, version, version, (a, b, c) => {
      const ab = compareAppVersions(a, b);
      if (ab !== -compareAppVersions(b, a)) return false;
      if (ab === 0 && a !== b) return false;
      const bc = compareAppVersions(b, c);
      return !(ab <= 0 && bc <= 0) || compareAppVersions(a, c) <= 0;
    }),
  );
});

test("comparing something that is not an application version is refused", () => {
  expect(() => compareAppVersions("dev", "1.6.0")).toThrow(/not an application version/);
});
