import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDaemonInfo, removeDaemonInfo, sandboxPortFor, writeDaemonInfo } from "./daemon-info";

test("daemon.json is private, readable back and removed on stop", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-info-"));
  expect(readDaemonInfo(home)).toBeNull();
  writeDaemonInfo(home, { port: 4317, sandboxPort: 4318, pid: 42 });
  expect(statSync(join(home, "daemon.json")).mode & 0o777).toBe(0o600);
  expect(readDaemonInfo(home)).toEqual({ port: 4317, sandboxPort: 4318, pid: 42 });
  removeDaemonInfo(home);
  expect(readDaemonInfo(home)).toBeNull();
  removeDaemonInfo(home);
  rmSync(home, { recursive: true, force: true });
});

test("a stale daemon.json from a looser umask is rewritten private", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-info-"));
  writeFileSync(join(home, "daemon.json"), "{}", { mode: 0o644 });
  writeDaemonInfo(home, { port: 1, sandboxPort: 2, pid: 3 });
  expect(statSync(join(home, "daemon.json")).mode & 0o777).toBe(0o600);
  rmSync(home, { recursive: true, force: true });
});

test("a malformed daemon.json reads as absent", () => {
  const home = mkdtempSync(join(tmpdir(), "kibo-info-"));
  for (const raw of ["null", "[]", '{"port":"4317","sandboxPort":4318,"pid":1}', '{"port":4317}']) {
    writeFileSync(join(home, "daemon.json"), raw);
    expect(readDaemonInfo(home)).toBeNull();
  }
  writeFileSync(join(home, "daemon.json"), "{not json");
  expect(() => readDaemonInfo(home)).toThrow();
  rmSync(home, { recursive: true, force: true });
});

test("the sandbox port follows the UI port unless given", () => {
  expect(sandboxPortFor(4317, undefined)).toBe(4318);
  expect(sandboxPortFor(0, undefined)).toBe(0);
  expect(sandboxPortFor(4317, "9000")).toBe(9000);
  expect(sandboxPortFor(4317, "0")).toBe(0);
  for (const bad of ["abc", "-1", "65536", "4.5", ""]) expect(() => sandboxPortFor(4317, bad)).toThrow();
  expect(() => sandboxPortFor(65535, undefined)).toThrow();
});
