import { afterEach, expect, spyOn, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ENV_FILE_MAX_BYTES } from "@kibo/schema";
import { readEnvPort } from "./env-port";

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-env-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("no env file means no port", () => {
  expect(readEnvPort(tmp(), "STORYBOOK_PORT")).toBeNull();
});

test(".env.local wins over .env", () => {
  const dir = tmp();
  writeFileSync(join(dir, ".env"), "STORYBOOK_PORT=6007\n");
  expect(readEnvPort(dir, "STORYBOOK_PORT")).toBe(6007);
  writeFileSync(join(dir, ".env.local"), 'export STORYBOOK_PORT="6008"\n');
  expect(readEnvPort(dir, "STORYBOOK_PORT")).toBe(6008);
});

test(".env is read when .env.local does not define the variable", () => {
  const dir = tmp();
  writeFileSync(join(dir, ".env.local"), "OTHER=1\n");
  writeFileSync(join(dir, ".env"), "STORYBOOK_PORT=6007\n");
  expect(readEnvPort(dir, "STORYBOOK_PORT")).toBe(6007);
});

test("an env file over 64 KiB is ignored", () => {
  const dir = tmp();
  writeFileSync(join(dir, ".env.local"), `STORYBOOK_PORT=6009\n${"#".repeat(ENV_FILE_MAX_BYTES)}`);
  writeFileSync(join(dir, ".env"), "STORYBOOK_PORT=6007\n");
  expect(readEnvPort(dir, "STORYBOOK_PORT")).toBe(6007);
});

test("an injected reader sees only the two env paths", () => {
  const read: string[] = [];
  const port = readEnvPort("/repo/wt", "SB", (path) => {
    read.push(path);
    return path.endsWith(".env") ? "SB=7000" : null;
  });
  expect(port).toBe(7000);
  expect(read).toEqual(["/repo/wt/.env.local", "/repo/wt/.env"]);
});

test("the first definition wins even when invalid, .env is then not used", () => {
  for (const invalid of ["STORYBOOK_PORT=abc", "STORYBOOK_PORT=80"]) {
    const dir = tmp();
    writeFileSync(join(dir, ".env.local"), `${invalid}\n`);
    writeFileSync(join(dir, ".env"), "STORYBOOK_PORT=6007\n");
    expect(readEnvPort(dir, "STORYBOOK_PORT")).toBeNull();
  }
});

test("an unreadable .env.local has no definition and .env is read, with a warning", () => {
  const dir = tmp();
  writeFileSync(join(dir, ".env.local"), "STORYBOOK_PORT=6009\n");
  chmodSync(join(dir, ".env.local"), 0o000);
  writeFileSync(join(dir, ".env"), "STORYBOOK_PORT=6007\n");
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    expect(readEnvPort(dir, "STORYBOOK_PORT")).toBe(6007);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(join(dir, ".env.local")));
  } finally {
    warn.mockRestore();
  }
});
