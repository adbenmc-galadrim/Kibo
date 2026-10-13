import { expect, test } from "bun:test";
import { projectsFixture } from "../agents/fixtures";
import { pluginSkill, skillFixture, skillsFixture } from "./fixtures";
import { openGroupKeys, parseCollapsed } from "./group-collapse";
import { isUsed, parseFilter, passesFilter } from "./skill-filters";
import { filterCounts, groupKeyOf, groupNotes, groupSkills } from "./skill-sections";

const ids = (filter: "all" | "used" | "notes", query = "") =>
  groupSkills(skillsFixture(), projectsFixture, query, filter).map((g) => [g.key, g.skills.map((s) => s.id)]);

test("a skill counts as used when its last use is known or it ran in the last 30 days", () => {
  expect(isUsed(skillFixture())).toBe(false);
  expect(isUsed(skillFixture({ usage: { last: null, runs30d: 2 } }))).toBe(true);
  expect(isUsed(skillFixture({ usage: { last: { runId: "r1", ticketKey: null, at: 1 }, runs30d: 0 } }))).toBe(
    true,
  );
  expect(passesFilter(skillFixture(), "all")).toBe(true);
  expect(passesFilter(skillFixture({ reviews: { open: 1 } }), "notes")).toBe(true);
  expect(passesFilter(skillFixture(), "notes")).toBe(false);
});

test("the used filter keeps used skills only and hides the groups left empty", () => {
  expect(ids("used")).toEqual([["user", ["porte-qualite"]]]);
});

test("the notes filter keeps skills with open notes, across groups, and combines with the search", () => {
  expect(ids("notes")).toEqual([
    ["user", ["porte-qualite"]],
    ["plugin:superpowers", ["superpowers:brainstorming"]],
  ]);
  expect(ids("notes", "brain")).toEqual([["plugin:superpowers", ["superpowers:brainstorming"]]]);
});

test("all keeps an empty project group, like before", () => {
  const groups = groupSkills([pluginSkill("brainstorming")], projectsFixture, "", "all");
  expect(groups.map((g) => [g.key, g.skills.length])).toEqual([
    ["user", 0],
    ["project:kibo", 0],
    ["plugin:superpowers", 1],
  ]);
});

test("each filter counts the skills it would show for the current search", () => {
  expect(filterCounts(skillsFixture(), projectsFixture, "")).toEqual({ all: 5, used: 1, notes: 2 });
  expect(filterCounts(skillsFixture(), projectsFixture, "brain")).toEqual({ all: 1, used: 0, notes: 1 });
});

test("a group sums the open notes of its skills", () => {
  const [user, , plugin] = groupSkills(skillsFixture(), projectsFixture, "", "all");
  expect(user && groupNotes(user)).toBe(2);
  expect(plugin && groupNotes(plugin)).toBe(1);
});

test("a skill belongs to the group of its source", () => {
  expect(groupKeyOf(skillFixture())).toBe("user");
  expect(groupKeyOf(skillFixture({ source: "project", projectId: "kibo" }))).toBe("project:kibo");
  expect(groupKeyOf(pluginSkill("brainstorming"))).toBe("plugin:superpowers");
});

test("plugin groups start collapsed, the others open, a stored choice wins", () => {
  const groups = groupSkills(skillsFixture(), projectsFixture, "", "all");
  const open = (collapsed: Record<string, boolean>, query = "", filter: "all" | "notes" = "all") =>
    [
      ...openGroupKeys(groups, { collapsed, overrides: {}, searching: query !== "" || filter !== "all" }),
    ].sort();
  expect(open({})).toEqual(["project:kibo", "user"]);
  expect(open({ "plugin:superpowers": false, user: true })).toEqual(["plugin:superpowers", "project:kibo"]);
});

test("a search or a filter opens every group with a result, an override wins over both", () => {
  const groups = groupSkills(skillsFixture(), projectsFixture, "", "all");
  const searching = openGroupKeys(groups, { collapsed: { user: true }, overrides: {}, searching: true });
  expect([...searching].sort()).toEqual(["plugin:superpowers", "project:kibo", "user"]);
  const empty = groupSkills([], projectsFixture, "", "all");
  expect([...openGroupKeys(empty, { collapsed: {}, overrides: {}, searching: true })]).toEqual([]);
  const overridden = openGroupKeys(groups, {
    collapsed: {},
    overrides: { "plugin:superpowers": true, user: false },
    searching: false,
  });
  expect([...overridden].sort()).toEqual(["plugin:superpowers", "project:kibo"]);
});

test("stored values parse safely, anything unexpected falls back to the default", () => {
  expect(parseFilter("notes")).toBe("notes");
  expect(parseFilter("bogus")).toBe("all");
  expect(parseCollapsed('{"user":true,"plugin:x":false}')).toEqual({ user: true, "plugin:x": false });
  expect(parseCollapsed('{"user":"yes","ok":true}')).toEqual({ ok: true });
  expect(parseCollapsed("[1]")).toEqual({});
  expect(parseCollapsed("{not json")).toEqual({});
});
