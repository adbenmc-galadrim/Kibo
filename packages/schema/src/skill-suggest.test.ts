import { describe, expect, test } from "bun:test";
import {
  filterSkillSuggestions,
  rankSkillSuggestions,
  SKILL_SUGGESTIONS_VISIBLE,
  type SkillSuggestion,
} from "./skill-suggest";

const suggestion = (id: string, runs30d = 0, lastAt: number | null = null): SkillSuggestion => ({
  id,
  name: id.split(":").at(-1) ?? id,
  description: `${id} description`,
  source: id.includes(":") ? "plugin" : "user",
  plugin: id.includes(":") ? (id.split(":")[0] ?? null) : null,
  runs30d,
  lastAt,
});

const ids = (list: readonly SkillSuggestion[]) => list.map((s) => s.id);

describe("rankSkillSuggestions", () => {
  test("most used first, then most recently used, then by id", () => {
    const ranked = rankSkillSuggestions([
      suggestion("zeta", 1, 10),
      suggestion("alpha", 0),
      suggestion("beta", 3, 5),
      suggestion("gamma", 1, 20),
      suggestion("delta", 0),
      suggestion("eta", 1, null),
    ]);
    expect(ids(ranked)).toEqual(["beta", "gamma", "zeta", "eta", "alpha", "delta"]);
  });
});

describe("filterSkillSuggestions", () => {
  const ranked = [
    suggestion("review-pr", 5),
    suggestion("superpowers:brainstorming", 4),
    suggestion("pr-description", 3),
    suggestion("brainstorming", 2),
    suggestion("deploy", 1),
  ];

  test("an empty query keeps the usage order", () => {
    expect(ids(filterSkillSuggestions(ranked, ""))).toEqual(ids(ranked));
  });

  test("prefix matches first, then substring matches, each in usage order", () => {
    expect(ids(filterSkillSuggestions(ranked, "pr"))).toEqual(["pr-description", "review-pr"]);
  });

  test("the name of a plugin skill counts as a prefix", () => {
    expect(ids(filterSkillSuggestions(ranked, "Brain"))).toEqual([
      "superpowers:brainstorming",
      "brainstorming",
    ]);
  });

  test("nothing matches", () => {
    expect(filterSkillSuggestions(ranked, "xyz")).toEqual([]);
  });

  test(`at most ${SKILL_SUGGESTIONS_VISIBLE} results`, () => {
    const many = Array.from({ length: 12 }, (_, i) => suggestion(`skill-${i}`));
    expect(filterSkillSuggestions(many, "skill")).toHaveLength(SKILL_SUGGESTIONS_VISIBLE);
  });
});
