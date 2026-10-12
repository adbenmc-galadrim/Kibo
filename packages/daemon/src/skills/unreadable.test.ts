import { expect, spyOn, test } from "bun:test";
import { chmodSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discoverSkills } from "./discover";
import { cleanSkillDirs, PROJECT_ID, skillsFixture } from "./fakes.test-helper";

cleanSkillDirs();

async function quietly<T>(run: () => Promise<T>): Promise<{ value: T; logged: boolean }> {
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    const value = await run();
    return { value, logged: log.mock.calls.length > 0 };
  } finally {
    log.mockRestore();
  }
}

async function withMode<T>(path: string, mode: number, run: () => Promise<T>): Promise<T> {
  chmodSync(path, mode);
  try {
    return await run();
  } finally {
    chmodSync(path, 0o755);
  }
}

test("a SKILL.md without read rights is listed with a problem", async () => {
  const f = skillsFixture();
  const file = join(f.claudeHome, "skills", "brainstorming", "SKILL.md");
  const { value, logged } = await quietly(() =>
    withMode(file, 0o000, () => discoverSkills(f.roots, f.projects, [])),
  );
  expect(value.find((s) => s.id === "brainstorming" && s.source === "user")).toMatchObject({
    problem: "fichier illisible",
    file: null,
    hash: null,
  });
  expect(value.find((s) => s.id === "deploy" && s.source === "user")?.problem).toBeNull();
  expect(logged).toBe(true);
});

test("a skills folder without rights gives no skill and a log line", async () => {
  const f = skillsFixture();
  const dir = join(f.claudeHome, "skills");
  const { value, logged } = await quietly(() =>
    withMode(dir, 0o000, () => discoverSkills(f.roots, f.projects, [])),
  );
  expect(value.map((s) => [s.id, s.projectId])).toEqual([
    ["deploy", PROJECT_ID],
    ["tests", PROJECT_ID],
  ]);
  expect(logged).toBe(true);
});

test("a skill folder whose assets cannot be read keeps its SKILL.md", async () => {
  const f = skillsFixture();
  const sub = join(f.claudeHome, "skills", "deploy", "docs");
  mkdirSync(sub);
  writeFileSync(join(sub, "a.md"), "x");
  const { value, logged } = await quietly(() =>
    withMode(sub, 0o000, () => discoverSkills(f.roots, f.projects, [])),
  );
  expect(value.find((s) => s.id === "deploy" && s.source === "user")).toMatchObject({
    problem: null,
    files: [],
  });
  expect(logged).toBe(true);
});

test("a broken link, a loop of links and a skills file instead of a folder never throw", async () => {
  const f = skillsFixture();
  const user = join(f.claudeHome, "skills");
  symlinkSync(join(user, "absent"), join(user, "broken"));
  symlinkSync(join(user, "loop-b"), join(user, "loop-a"));
  symlinkSync(join(user, "loop-a"), join(user, "loop-b"));
  const projectSkills = join(f.project, ".claude", "skills");
  rmSync(projectSkills, { recursive: true, force: true });
  writeFileSync(projectSkills, "pas un dossier");
  const { value } = await quietly(() => discoverSkills(f.roots, f.projects, []));
  expect(value.map((s) => [s.id, s.source])).toEqual([
    ["brainstorming", "user"],
    ["deploy", "user"],
  ]);
});
