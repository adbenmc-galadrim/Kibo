import { expect, test } from "bun:test";
import { parseSkillId, skillIdOf } from "./skill-id";

test("a plugin skill is prefixed by its plugin, the others are not", () => {
  expect(skillIdOf("plugin", "superpowers", "brainstorming")).toBe("superpowers:brainstorming");
  expect(skillIdOf("user", null, "deploy")).toBe("deploy");
  expect(skillIdOf("project", null, "deploy")).toBe("deploy");
  expect(parseSkillId("superpowers:brainstorming")).toEqual({ plugin: "superpowers", name: "brainstorming" });
  expect(parseSkillId("deploy")).toEqual({ plugin: null, name: "deploy" });
});
