import { expect, test } from "bun:test";
import { compareSemver, NO_PERMISSIONS } from "@kibo/schema";
import { bumpVersion, proposeVersion } from "./draft-version";

test("bumpVersion", () => {
  expect(bumpVersion("0.1.3", "minor")).toBe("0.2.0");
  expect(bumpVersion("0.1.3", "patch")).toBe("0.1.4");
});

test("proposeVersion: 0.1.0 on create, patch if nothing changes, minor otherwise", () => {
  expect(proposeVersion(null, { permissions: NO_PERMISSIONS, configVersion: 0 })).toBe("0.1.0");
  const reads = { ...NO_PERMISSIONS, reads: ["ticket" as const] };
  const base = { version: "0.1.0", permissions: reads, configVersion: 0 };
  expect(proposeVersion(base, { permissions: { ...reads }, configVersion: 0 })).toBe("0.1.1");
  expect(
    proposeVersion(base, { permissions: { ...reads, net: ["api.github.com/x"] }, configVersion: 0 }),
  ).toBe("0.2.0");
  expect(proposeVersion(base, { permissions: { ...reads, mcp: ["figma"] }, configVersion: 0 })).toBe("0.2.0");
  expect(proposeVersion(base, { permissions: NO_PERMISSIONS, configVersion: 0 })).toBe("0.2.0");
  expect(proposeVersion(base, { permissions: reads, configVersion: 1 })).toBe("0.2.0");
});

test("proposeVersion is always above the published version", () => {
  for (const version of ["0.0.0", "0.1.9", "1.9.9", "10.0.0"]) {
    const base = { version, permissions: NO_PERMISSIONS, configVersion: 0 };
    for (const configVersion of [0, 1])
      expect(
        compareSemver(proposeVersion(base, { permissions: NO_PERMISSIONS, configVersion }), version),
      ).toBe(1);
  }
});
