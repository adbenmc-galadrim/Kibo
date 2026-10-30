import { describe, expect, test } from "bun:test";
import type { AiStatus } from "@kibo/schema";
import { claudeStatus, type Exec, parseAuthStatus, parseVersion } from "./claude-status";

const exec =
  (answers: Record<string, { code: number; stdout: string } | null>): Exec =>
  async (argv) => {
    const a = answers[argv.slice(1).join(" ")];
    return a === undefined || a === null ? null : { ...a, stderr: "" };
  };
const NO_PROFILES = { assistant: false, generateur: false };

test("parseVersion and parseAuthStatus", () => {
  expect(parseVersion("2.1.283 (Claude Code)")).toBe("2.1.283");
  expect(parseVersion("nope")).toBeNull();
  expect(parseAuthStatus('{"loggedIn":true}')).toBe(true);
  expect(parseAuthStatus('{"loggedIn":false}\n')).toBe(false);
  expect(parseAuthStatus("error: unknown command 'auth'")).toBeNull();
});

describe("claudeStatus", () => {
  test("a missing binary is unavailable", async () => {
    const missing: AiStatus = {
      available: false,
      reason: "missing",
      version: null,
      loggedIn: null,
      profiles: NO_PROFILES,
    };
    expect(await claudeStatus(exec({}), null)).toEqual(missing);
    expect(await claudeStatus(exec({ "--version": { code: 127, stdout: "" } }), "claude")).toEqual(missing);
  });
  test("reads the version and the login", async () => {
    const answers = {
      "--version": { code: 0, stdout: "2.1.283 (Claude Code)" },
      "auth status --json": { code: 0, stdout: '{"loggedIn":true}' },
    };
    expect(await claudeStatus(exec(answers), "claude")).toEqual({
      available: true,
      reason: null,
      version: "2.1.283",
      loggedIn: true,
      profiles: NO_PROFILES,
    });
  });
  test("a logged-out claude is unavailable, an unknown login is available", async () => {
    const version = { code: 0, stdout: "2.1.283 (Claude Code)" };
    const out = exec({
      "--version": version,
      "auth status --json": { code: 0, stdout: '{"loggedIn":false}' },
    });
    expect(await claudeStatus(out, "claude")).toMatchObject({ available: false, reason: "logged_out" });
    const unknown = exec({ "--version": version, "auth status --json": { code: 1, stdout: "error" } });
    expect(await claudeStatus(unknown, "claude")).toMatchObject({ available: true, loggedIn: null });
  });
});
