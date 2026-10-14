import { expect, test } from "bun:test";
import { EMPTY_DELIVERY, isSafeAddDir, KiboError } from "@kibo/schema";
import fc from "fast-check";
import { addDirsOf, assertAddDirs } from "./add-dirs";

const HOME = "/Users/a";
const SKILLS = "/Users/a/.claude/skills";
const EMIS = "/Users/a/Documents/emis";

function io(present: readonly string[]) {
  const lines: string[] = [];
  return {
    lines,
    io: { home: HOME, exists: (p: string) => present.includes(p), log: (l: string) => lines.push(l) },
  };
}

test("the agent folders come first, then the project ones, without duplicates or missing folders", () => {
  const { lines, io: deps } = io([SKILLS, EMIS]);
  const project = { ...EMPTY_DELIVERY, addDirs: [EMIS, SKILLS] };
  expect(addDirsOf({ addDirs: [SKILLS, "/Users/a/gone"] }, project, deps)).toEqual([SKILLS, EMIS]);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("/Users/a/gone");
});

test("without a delivery setting only the agent folders count", () => {
  expect(addDirsOf({ addDirs: [SKILLS] }, null, io([SKILLS]).io)).toEqual([SKILLS]);
  expect(addDirsOf({ addDirs: [] }, null, io([]).io)).toEqual([]);
});

test("a forbidden folder is refused by name, wherever it comes from", () => {
  expect(() => assertAddDirs(["/Users/a/.kibo"], HOME)).toThrow(/INVALID_INPUT.*\.kibo/);
  expect(() => assertAddDirs([SKILLS, EMIS], HOME)).not.toThrow();
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
      const deps = { home: HOME, exists: () => true, log: () => undefined };
      try {
        const dirs = addDirsOf({ addDirs: agent }, { ...EMPTY_DELIVERY, addDirs: project }, deps);
        expect(dirs.every((d) => isSafeAddDir(d, HOME))).toBe(true);
      } catch (e) {
        expect(e).toBeInstanceOf(KiboError);
      }
    }),
  );
});
