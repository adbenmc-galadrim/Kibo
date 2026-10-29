import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMPTY_DELIVERY, isSafeAddDir, KiboError } from "@kibo/schema";
import fc from "fast-check";
import { addDirsOf, assertAddDirs, realpathOrNull } from "./add-dirs";

const HOME = "/Users/a";
const SKILLS = "/Users/a/.claude/skills";
const SILO = "/Users/a/Documents/silo";

function io(present: readonly string[]) {
  const lines: string[] = [];
  const realpath = (p: string) => (p === HOME || present.includes(p) ? p : null);
  return { lines, io: { home: HOME, realpath, log: (l: string) => lines.push(l) } };
}

test("the agent folders come first, then the project ones, without duplicates or missing folders", () => {
  const { lines, io: deps } = io([SKILLS, SILO]);
  const project = { ...EMPTY_DELIVERY, addDirs: [SILO, SKILLS] };
  expect(addDirsOf({ addDirs: [SKILLS, "/Users/a/gone"] }, project, deps)).toEqual([SKILLS, SILO]);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("/Users/a/gone");
});

test("without a delivery setting only the agent folders count", () => {
  expect(addDirsOf({ addDirs: [SKILLS] }, null, io([SKILLS]).io)).toEqual([SKILLS]);
  expect(addDirsOf({ addDirs: [] }, null, io([]).io)).toEqual([]);
});

test("a forbidden folder is refused by name, wherever it comes from", () => {
  expect(() => assertAddDirs(["/Users/a/.kibo"], HOME)).toThrow(/INVALID_INPUT.*\.kibo/);
  expect(() => assertAddDirs([SKILLS, SILO], HOME)).not.toThrow();
  const project = { ...EMPTY_DELIVERY, addDirs: ["/Users/a/.ssh"] };
  expect(() => addDirsOf({ addDirs: [] }, project, io(["/Users/a/.ssh"]).io)).toThrow(/\.ssh/);
  expect(() => addDirsOf({ addDirs: ["/etc"] }, null, io(["/etc"]).io)).toThrow(KiboError);
});

const segment = fc.constantFrom("..", ".", ".kibo", ".ssh", ".claude", ".config", "skills", "a", "Users", "");
const path = fc
  .array(segment, { maxLength: 5 })
  .chain((parts) => fc.constantFrom(`/${parts.join("/")}`, `${HOME}/${parts.join("/")}`, parts.join("/")));

test("whatever the folders, Kibo never passes a forbidden one nor one outside the home folder", () => {
  fc.assert(
    fc.property(fc.array(path, { maxLength: 6 }), fc.array(path, { maxLength: 6 }), (agent, project) => {
      const deps = { home: HOME, realpath: (p: string) => p, log: () => undefined };
      try {
        const dirs = addDirsOf({ addDirs: agent }, { ...EMPTY_DELIVERY, addDirs: project }, deps);
        expect(dirs.every((d) => isSafeAddDir(d, HOME))).toBe(true);
      } catch (e) {
        expect(e).toBeInstanceOf(KiboError);
      }
    }),
  );
});

const homes: string[] = [];
afterEach(() => {
  for (const dir of homes.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function realHome() {
  const home = mkdtempSync(join(tmpdir(), "kibo-add-dirs-"));
  homes.push(home);
  const deps = { home, realpath: realpathOrNull, log: () => undefined };
  return { home, deps };
}

test("a link to a secret folder is refused once resolved, a link to a safe folder passes resolved", () => {
  const { home, deps } = realHome();
  mkdirSync(join(home, ".ssh"));
  mkdirSync(join(home, "code", "silo"), { recursive: true });
  symlinkSync(join(home, ".ssh"), join(home, "keys"));
  symlinkSync(join(home, "code", "silo"), join(home, "silo"));
  expect(() => addDirsOf({ addDirs: [join(home, "keys")] }, null, deps)).toThrow(/INVALID_INPUT.*keys/);
  expect(addDirsOf({ addDirs: [join(home, "silo")] }, null, deps)).toEqual([
    realpathSync(join(home, "code", "silo")),
  ]);
});

test("a link that leaves the home folder is refused", () => {
  const { home, deps } = realHome();
  symlinkSync("/etc", join(home, "etc"));
  expect(() => addDirsOf({ addDirs: [join(home, "etc")] }, null, deps)).toThrow("INVALID_INPUT");
});
