import { expect, test } from "bun:test";
import type { Screen } from "@kibo/schema";
import { isRetiredScreen, isRetiredTarget, type RetiredRoute, retiredRoute } from "./retired-routes";

const HOME: RetiredRoute = { kind: "home" };

test("the eight routes of the agent era lead back home", () => {
  for (const hash of [
    "#/agents",
    "#/queue",
    "#/skills",
    "#/creations",
    "#/components",
    "#/settings/sources",
    "#/settings/domains",
    "#/code",
  ])
    expect([hash, retiredRoute(hash)]).toEqual([hash, HOME]);
});

test("their real hashes, sub-paths and run, skill and changes tabs lead back home too", () => {
  for (const hash of [
    "#/agents/queue",
    "#/agents/skills",
    "#/settings/components",
    "#/agents/",
    "#/skills/superpowers%3Abrainstorming",
    "#/runs/r1",
    "#/p/emis/changes",
    "#/p/emis/changes?wt=feat",
  ])
    expect([hash, retiredRoute(hash)]).toEqual([hash, HOME]);
});

test("the tracking routes stay", () => {
  for (const hash of [
    "#/",
    "",
    "#/inbox",
    "#/mine",
    "#/settings/general",
    "#/settings/integrations",
    "#/p/emis/",
    "#/p/emis/page1",
    "#/p/emis/t/EMIS-12",
    "#/p/emis/file?path=README.md",
    "#/codex",
  ])
    expect([hash, retiredRoute(hash)]).toEqual([hash, null]);
});

test("retired screens and targets", () => {
  const retired: Screen[] = ["agents", "queue", "skills", "creations", "components", "sources", "domains"];
  expect(retired.every(isRetiredScreen)).toBe(true);
  expect(isRetiredScreen("general")).toBe(false);
  expect(isRetiredScreen(null)).toBe(false);
  expect(isRetiredTarget({ kind: "changes", projectId: "p1", worktree: null })).toBe(true);
  expect(isRetiredTarget({ kind: "run", runId: "r1" })).toBe(true);
  expect(isRetiredTarget({ kind: "skill", skillId: "s" })).toBe(true);
  expect(isRetiredTarget({ kind: "ticket", projectId: "p1", ticketId: "t1" })).toBe(false);
  expect(isRetiredTarget({ kind: "screen", screen: "inbox" })).toBe(false);
});
