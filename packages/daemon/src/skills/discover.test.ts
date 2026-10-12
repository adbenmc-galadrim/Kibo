import { expect, test } from "bun:test";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { discoverSkills, resolveSkillFile } from "./discover";
import { cleanSkillDirs, PROJECT_ID, put, SKILL_MD, sha256, skillsFixture } from "./fakes.test-helper";
import { readInstalledPlugins } from "./plugins";

cleanSkillDirs();

async function discovered() {
  const f = skillsFixture();
  const skills = await discoverSkills(f.roots, f.projects, await readInstalledPlugins(f.pluginsRoot));
  return { f, skills };
}

test("the three sources are read with their ids, in display order", async () => {
  const { skills } = await discovered();
  expect(skills.map((s) => [s.id, s.source, s.projectId, s.readOnly])).toEqual([
    ["brainstorming", "user", null, false],
    ["deploy", "user", null, false],
    ["deploy", "project", PROJECT_ID, false],
    ["tests", "project", PROJECT_ID, false],
    ["superpowers:brainstorming", "plugin", null, true],
    ["superpowers:release", "plugin", null, true],
  ]);
  const plugin = skills.find((s) => s.id === "superpowers:release");
  expect(plugin?.plugin).toEqual({ name: "superpowers", version: "6.4.1" });
  expect(plugin?.path.endsWith(join("workflow-skills", "release"))).toBe(true);
});

test("a skill carries its frontmatter, description, hash and modification date", async () => {
  const { f, skills } = await discovered();
  const deploy = skills.find((s) => s.id === "deploy" && s.source === "user");
  const content = SKILL_MD("deploy", "Déploie l'application");
  expect(deploy).toMatchObject({
    name: "deploy",
    description: "Déploie l'application",
    path: join(f.claudeHome, "skills", "deploy"),
    problem: null,
    hash: sha256(content),
    plugin: null,
  });
  expect(deploy?.file?.frontmatter.description).toBe("Déploie l'application");
  expect(typeof deploy?.modifiedAt).toBe("number");
});

test("assets are listed: text by size and extension, binaries listed, symbolic links left out", async () => {
  const { skills } = await discovered();
  const deploy = skills.find((s) => s.id === "deploy" && s.source === "user");
  expect(deploy?.files.map((a) => [a.path, a.text])).toEqual([
    ["big.md", false],
    ["image.png", false],
    ["reference.md", true],
    ["script.sh", true],
  ]);
  expect(deploy?.files.find((a) => a.path === "script.sh")?.size).toBe(8);
});

test("an unreadable SKILL.md gives a problem, a frontmatter name keeps the folder as id", async () => {
  const f = skillsFixture();
  put(join(f.claudeHome, "skills", "broken", "SKILL.md"), "---\nname: broken\ndescription: [a, b\n");
  put(join(f.claudeHome, "skills", "renamed", "SKILL.md"), SKILL_MD("autre-nom", "Nom différent"));
  const skills = await discoverSkills(f.roots, f.projects, []);
  const broken = skills.find((s) => s.id === "broken");
  expect(broken?.file).toBeNull();
  expect(broken?.problem).toEqual(expect.any(String));
  expect(skills.find((s) => s.id === "renamed")).toMatchObject({ name: "autre-nom", problem: null });
});

test("a folder without SKILL.md, a bad folder name or a project without folder is skipped", async () => {
  const f = skillsFixture();
  put(join(f.claudeHome, "skills", "empty", "README.md"), "x");
  put(join(f.claudeHome, "skills", "Bad Name", "SKILL.md"), SKILL_MD("bad", "Mauvais nom"));
  const skills = await discoverSkills(f.roots, [...f.projects, { id: "p2", folder: null }], []);
  expect(skills.map((s) => s.id)).toEqual(["brainstorming", "deploy", "deploy", "tests"]);
});

test("a missing skills folder gives no skill", async () => {
  const f = skillsFixture();
  const roots = { ...f.roots, claudeHome: join(f.base, "nowhere") };
  expect(await discoverSkills(roots, [], [])).toEqual([]);
});

test("a skill file resolves inside its folder only", async () => {
  const { f } = await discovered();
  const dir = join(f.claudeHome, "skills", "deploy");
  expect(await resolveSkillFile(dir, "reference.md")).toBe(join(dir, "reference.md"));
  expect(await resolveSkillFile(dir, "docs/new.md")).toBe(join(dir, "docs", "new.md"));
  for (const bad of ["../x", "/etc/passwd", "link.md", "a/../../x", ""]) {
    const refused = await resolveSkillFile(dir, bad).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(KiboError);
    expect(refused).toMatchObject({ code: "FORBIDDEN" });
  }
});
