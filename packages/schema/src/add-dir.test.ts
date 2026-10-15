import { expect, test } from "bun:test";
import { ADD_DIRS_MAX, AddDirs, FORBIDDEN_HOME_DIRS, isSafeAddDir } from "./add-dir";

const HOME = "/Users/a";

test("a folder under the home directory is safe, the home itself is not", () => {
  expect(isSafeAddDir("/Users/a/.claude/skills", HOME)).toBe(true);
  expect(isSafeAddDir("/Users/a/Documents/emis", HOME)).toBe(true);
  expect(isSafeAddDir("/Users/a", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/a/", HOME)).toBe(false);
});

test("the .claude root is refused but its sub-folders are allowed", () => {
  expect(isSafeAddDir("/Users/a/.claude", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/a/.claude/agents", HOME)).toBe(true);
  expect(isSafeAddDir("/Users/a/.claude/projects", HOME)).toBe(true);
});

test("folders holding secrets are refused, with everything below them", () => {
  expect(FORBIDDEN_HOME_DIRS).toEqual([".kibo", ".ssh", ".gnupg", ".aws", ".config"]);
  expect(isSafeAddDir("/Users/a/.kibo", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/a/.ssh/x", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/a/.config", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/a/.gnupg/keys", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/a//.aws", HOME)).toBe(false);
});

test("climbing, relative paths and paths outside the home are refused", () => {
  expect(isSafeAddDir("/Users/a/x/../.kibo", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/a/./.kibo", HOME)).toBe(false);
  expect(isSafeAddDir("/etc", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/ab/x", HOME)).toBe(false);
  expect(isSafeAddDir("relative", HOME)).toBe(false);
  expect(isSafeAddDir("~/x", HOME)).toBe(false);
  expect(isSafeAddDir("/Users/a/x\ny", HOME)).toBe(false);
  expect(isSafeAddDir("/x", "/")).toBe(false);
});

test("a list holds at most twenty folders", () => {
  const dirs = Array.from({ length: ADD_DIRS_MAX }, (_, i) => `/Users/a/d${i}`);
  expect(AddDirs.safeParse(dirs).success).toBe(true);
  expect(AddDirs.safeParse([...dirs, "/Users/a/more"]).success).toBe(false);
  expect(AddDirs.safeParse([""]).success).toBe(false);
});

test("secret folders and the .claude root are refused whatever their case", () => {
  for (const dir of [".SSH", ".Kibo", ".KIBO/x", ".AWS", ".GnuPG", ".Config/gh", ".CLAUDE", ".Claude/"]) {
    expect(isSafeAddDir(`/Users/a/${dir}`, HOME)).toBe(false);
  }
  expect(isSafeAddDir("/Users/a/.Claude/skills", HOME)).toBe(true);
});

test("doubled slashes collapse like the system does, a blank folder stays under the home", () => {
  expect(isSafeAddDir("//Users/a/ ", HOME)).toBe(true);
  expect(isSafeAddDir("/Users//a/ ", HOME)).toBe(true);
  expect(isSafeAddDir("//Users/a/.kibo", HOME)).toBe(false);
  expect(isSafeAddDir("/Users//a//.ssh/", HOME)).toBe(false);
});
