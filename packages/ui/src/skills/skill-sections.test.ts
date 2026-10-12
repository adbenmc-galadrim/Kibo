import { expect, test } from "bun:test";
import { projectsFixture } from "../agents/fixtures";
import { pluginSkill, skillFixture, skillsFixture } from "./fixtures";
import { agoText, groupSkills, matchesSkill, skillAddress, skillHistoryRef } from "./skill-sections";

const projects = [
  ...projectsFixture,
  ...projectsFixture.slice(0, 1).map((p) => ({ ...p, id: "vide", name: "Vide", folder: "/code/vide" })),
];

test("groups come in order: this computer, one per project with a folder, then one per plugin", () => {
  const groups = groupSkills(skillsFixture(), projectsFixture, "");
  expect(groups.map((g) => g.title)).toEqual(["Cet ordinateur", "Projet · Kibo", "superpowers 6.4.1"]);
  expect(groups.map((g) => g.readOnly)).toEqual([false, false, true]);
  expect(groups[0]?.skills.map((s) => s.name)).toEqual(["apply-review", "porte-qualite"]);
  expect(groups[2]?.skills.map((s) => s.id)).toEqual([
    "superpowers:brainstorming",
    "superpowers:writing-plans",
  ]);
});

test("a project with a folder keeps its group even when empty, a project without folder has none", () => {
  const groups = groupSkills(skillsFixture(), projects, "");
  expect(groups.map((g) => g.key)).toEqual(["user", "project:kibo", "project:vide", "plugin:superpowers"]);
  expect(groups.find((g) => g.key === "project:vide")?.skills).toEqual([]);
  expect(groups.find((g) => g.key === "project:kibo")?.hint).toBe("/Users/adam/goinfre/Kibo/.claude/skills");
});

test("the search matches id, name and description, without accents nor case, and drops empty groups", () => {
  expect(groupSkills(skillsFixture(), projects, "BRAIN").flatMap((g) => g.skills.map((s) => s.id))).toEqual([
    "superpowers:brainstorming",
  ]);
  expect(groupSkills(skillsFixture(), projects, "qualite").flatMap((g) => g.skills.map((s) => s.id))).toEqual(
    ["porte-qualite"],
  );
  expect(matchesSkill(skillFixture({ description: "Démonte l'environnement" }), "demonte")).toBe(true);
  expect(groupSkills(skillsFixture(), projects, "zzz")).toEqual([]);
});

test("a skill is addressed with its scope, and its history ref follows the daemon's", () => {
  expect(skillAddress(skillFixture())).toEqual({ id: "porte-qualite", scope: "user" });
  const project = skillFixture({ id: "clean-pr", source: "project", projectId: "kibo" });
  expect(skillAddress(project)).toEqual({ id: "clean-pr", scope: "project", projectId: "kibo" });
  expect(skillAddress(pluginSkill("brainstorming"))).toEqual({
    id: "superpowers:brainstorming",
    scope: "plugin",
    plugin: "superpowers",
  });
  expect(skillHistoryRef(skillFixture())).toBe("user:porte-qualite");
  expect(skillHistoryRef(project)).toBe("project:kibo:clean-pr");
});

test("a past time reads in minutes, hours or days", () => {
  expect(agoText(5 * 60_000)).toBe("5 min");
  expect(agoText(2 * 3_600_000)).toBe("2 h");
  expect(agoText(2 * 86_400_000)).toBe("2 j");
  expect(agoText(10_000)).toBe("1 min");
});
