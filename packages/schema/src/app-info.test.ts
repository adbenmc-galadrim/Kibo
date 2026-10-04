import { expect, test } from "bun:test";
import { AppInfo } from "./app-info";

test("AppInfo requires a semver version and a known platform", () => {
  const ok = {
    version: "1.5.0",
    platform: "darwin",
    arch: "arm64",
    home: "~/.kibo",
    daemonPid: 42,
    uptimeMs: 0,
  };
  expect(AppInfo.safeParse(ok).success).toBe(true);
  expect(AppInfo.safeParse({ ...ok, version: "1.5" }).success).toBe(false);
  expect(AppInfo.safeParse({ ...ok, platform: "win32" }).success).toBe(false);
  expect(AppInfo.safeParse({ ...ok, daemonPid: 0 }).success).toBe(false);
});
