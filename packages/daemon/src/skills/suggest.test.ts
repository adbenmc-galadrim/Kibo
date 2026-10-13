import { expect, test } from "bun:test";
import type { Skill, SkillSource } from "@kibo/schema";
import { NO_USAGE, PROJECT_ID } from "./fakes.test-helper";
import { suggestSkills } from "./suggest";

const skill = (id: string, source: SkillSource, runs30d = 0, at: number | null = null): Skill => ({
  id,
  source,
  projectId: source === "project" ? PROJECT_ID : null,
  plugin: source === "plugin" ? { name: id.split(":")[0] ?? "", version: "1.0.0" } : null,
  name: id.split(":").at(-1) ?? id,
  description: `${id} description`,
  path: `/skills/${id}`,
  file: { frontmatter: { extra: "", extraKeys: [] }, body: "corps long" },
  problem: null,
  hash: null,
  readOnly: source === "plugin",
  shadowedBy: null,
  files: [],
  usage: { ...NO_USAGE, runs30d, last: at === null ? null : { runId: "r", ticketKey: "KIB-1", at } },
  reviews: { open: 0 },
  modifiedAt: null,
});

const visible = [
  skill("deploy", "user", 1, 50),
  skill("tests", "project", 4, 10),
  { ...skill("deploy", "project", 9, 90), shadowedBy: "deploy" },
  skill("superpowers:brainstorming", "plugin", 4, 30),
  skill("notes", "user"),
];

test("every visible skill for an agent allowed to use all, ranked by usage, without bodies", () => {
  const suggested = suggestSkills(visible, { mode: "all" });
  expect(suggested.map((s) => s.id)).toEqual(["superpowers:brainstorming", "tests", "deploy", "notes"]);
  expect(suggested[0]).toEqual({
    id: "superpowers:brainstorming",
    name: "brainstorming",
    description: "superpowers:brainstorming description",
    source: "plugin",
    plugin: "superpowers",
    runs30d: 4,
    lastAt: 30,
  });
});

test("only the allowed skills of a list, missing ones dropped", () => {
  const rule = { mode: "list" as const, ids: ["notes", "superpowers:brainstorming", "gone"] };
  expect(suggestSkills(visible, rule).map((s) => s.id)).toEqual(["superpowers:brainstorming", "notes"]);
});

test("an agent without skills gets an empty list", () => {
  expect(suggestSkills(visible, { mode: "list", ids: [] })).toEqual([]);
});
