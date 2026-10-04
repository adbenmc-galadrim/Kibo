import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { demoNotesCleanup } from "./notes-cleanup";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup(opts: { demo?: boolean; notesDir?: (home: string) => string } = {}) {
  const home = mkdtempSync(join(tmpdir(), "kibo-demo-notes-"));
  dirs.push(home);
  const demoDir = join(home, "notes", "DEMO");
  mkdirSync(demoDir, { recursive: true });
  writeFileSync(join(demoDir, "bienvenue.md"), "# Bienvenue\n");
  const logged: string[] = [];
  const cleanup = demoNotesCleanup({
    home,
    isDemo: () => opts.demo ?? true,
    notesDir: () => (opts.notesDir ? opts.notesDir(home) : demoDir),
    log: (message) => logged.push(message),
  });
  return { home, demoDir, cleanup, logged };
}

test("the notes folder of a deleted demo project is removed after the deletion", () => {
  const { demoDir, cleanup } = setup();
  const after = cleanup("p1");
  expect(existsSync(demoDir)).toBe(true);
  after?.();
  expect(existsSync(demoDir)).toBe(false);
});

test("a project that is not the demo keeps its notes", () => {
  const { demoDir, cleanup } = setup({ demo: false });
  expect(cleanup("p1")).toBeNull();
  expect(existsSync(demoDir)).toBe(true);
});

test("a notes folder chosen elsewhere is never removed", () => {
  const { home, cleanup } = setup({ notesDir: (h) => join(h, "mes-notes") });
  mkdirSync(join(home, "mes-notes"));
  expect(cleanup("p1")).toBeNull();
  expect(existsSync(join(home, "mes-notes"))).toBe(true);
});

test("a symbolic link in place of the demo notes is left alone with its target", () => {
  const { home, demoDir, cleanup, logged } = setup();
  const target = join(home, "ailleurs");
  mkdirSync(target);
  writeFileSync(join(target, "garde.md"), "x");
  rmSync(demoDir, { recursive: true });
  symlinkSync(target, demoDir);
  cleanup("p1")?.();
  expect(existsSync(join(target, "garde.md"))).toBe(true);
  expect(logged).toEqual([`demo notes ${demoDir} are not a plain folder, kept`]);
});

test("a demo without notes folder is fine", () => {
  const { demoDir, cleanup } = setup();
  rmSync(demoDir, { recursive: true });
  expect(() => cleanup("p1")?.()).not.toThrow();
});

test("a notes parent replaced by a symbolic link is never followed", () => {
  const { home, cleanup } = setup();
  const elsewhere = join(home, "autre");
  mkdirSync(join(elsewhere, "DEMO"), { recursive: true });
  writeFileSync(join(elsewhere, "DEMO", "garde.md"), "x");
  rmSync(join(home, "notes"), { recursive: true });
  symlinkSync(elsewhere, join(home, "notes"));
  expect(cleanup("p1")).toBeNull();
  expect(existsSync(join(elsewhere, "DEMO", "garde.md"))).toBe(true);
});
