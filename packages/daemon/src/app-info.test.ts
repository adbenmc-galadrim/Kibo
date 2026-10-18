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
    today: () => "2026-10-16",
    platform: "darwin",
    arch: "arm64",
  });
  expect(info()).toEqual({
    version: "1.5.0",
    platform: "darwin",
    arch: "arm64",
    home: "~/.kibo",
    userHome: null,
    daemonPid: 7,
    uptimeMs: 6_000,
    fixedNow: null,
    today: "2026-10-16",
  });
  now = 20_000;
  expect(info().uptimeMs).toBe(16_000);
});

test("createAppInfo reports the frozen instant of the daemon clock", () => {
  const info = createAppInfo({
    version: "1.5.0",
    home: "/h",
    userHome: "/u",
    pid: 7,
    startedAt: 0,
    now: () => 0,
    today: () => "2026-10-16",
    platform: "darwin",
    arch: "arm64",
    fixedNow: "2026-10-16T14:52:00+02:00",
  });
  expect(info().fixedNow).toBe("2026-10-16T14:52:00+02:00");
});

test("createAppInfo refuses a platform or an architecture Kibo does not ship", () => {
  const base = {
    version: "1.5.0",
    home: "/h",
    userHome: "/h",
    pid: 7,
    startedAt: 0,
    now: () => 0,
    today: () => "2026-10-16",
  };
  expect(() => createAppInfo({ ...base, platform: "win32", arch: "x64" })).toThrow(/unsupported platform/);
  expect(() => createAppInfo({ ...base, platform: "linux", arch: "ia32" })).toThrow(
    /unsupported architecture/,
  );
});

test("createAppInfo reads the day from the daemon clock on every call", () => {
  let day = "2026-10-16";
  const info = createAppInfo({
    version: "1.5.0",
    home: "/h",
    userHome: "/u",
    pid: 7,
    startedAt: 0,
    now: () => 0,
    today: () => day,
    platform: "darwin",
    arch: "arm64",
  });
  expect(info().today).toBe("2026-10-16");
  day = "2026-10-17";
  expect(info().today).toBe("2026-10-17");
});
