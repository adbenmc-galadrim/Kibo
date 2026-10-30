import { describe, expect, test } from "bun:test";
import { SkillId } from "./skill";

describe("skill ids", () => {
  test("a plain name or a plugin prefix", () => {
    for (const ok of ["brainstorming", "superpowers:brainstorming", "my.skill"]) {
      expect(SkillId.safeParse(ok).success).toBe(true);
    }
    for (const ko of ["Bad", "a:b:c"]) expect(SkillId.safeParse(ko).success).toBe(false);
  });
});
