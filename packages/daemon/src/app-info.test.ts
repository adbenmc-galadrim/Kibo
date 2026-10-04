import { expect, test } from "bun:test";
import { abbreviateHomePath, createAppInfo } from "./app-info";

test("abbreviateHomePath replaces the user home only at the start", () => {
  expect(abbreviateHomePath("/Users/adam/.kibo", "/Users/adam")).toBe("~/.kibo");
  expect(abbreviateHomePath("/Users/adam", "/Users/adam")).toBe("~");
  expect(abbreviateHomePath("/tmp/x/Users/adam", "/Users/adam")).toBe("/tmp/x/Users/adam");
  expect(abbreviateHomePath("/Users/adamx/.kibo", "/Users/adam")).toBe("/Users/adamx/.kibo");
});

test("createAppInfo maps the platform and counts uptime from the injected clock", () => {
  let now = 10_000;
  const info = createAppInfo({
    version: "1.5.0",
    home: "/Users/adam/.kibo",
    userHome: "/Users/adam",
    pid: 7,
    startedAt: 4_000,
    now: () => now,
    platform: "darwin",
    arch: "arm64",
  });
  expect(info()).toEqual({
    version: "1.5.0",
    platform: "darwin",
    arch: "arm64",
    home: "~/.kibo",
    daemonPid: 7,
    uptimeMs: 6_000,
  });
  now = 20_000;
  expect(info().uptimeMs).toBe(16_000);
});

test("createAppInfo refuses a platform or an architecture Kibo does not ship", () => {
  const base = { version: "1.5.0", home: "/h", userHome: "/h", pid: 7, startedAt: 0, now: () => 0 };
  expect(() => createAppInfo({ ...base, platform: "win32", arch: "x64" })).toThrow(/unsupported platform/);
  expect(() => createAppInfo({ ...base, platform: "linux", arch: "ia32" })).toThrow(
    /unsupported architecture/,
  );
});
