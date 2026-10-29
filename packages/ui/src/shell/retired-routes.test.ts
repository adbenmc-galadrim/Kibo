import { expect, test } from "bun:test";
import type { Screen } from "@kibo/schema";
import { targetToHash } from "../tabs/target-hash";
import { isRetiredScreen, type RetiredRoute, retiredRoute } from "./retired-routes";

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

test("the sync and security settings of the remote era lead back home", () => {
  for (const hash of ["#/settings/sync", "#/settings/security", "#/settings/sync/"])
    expect([hash, retiredRoute(hash)]).toEqual([hash, HOME]);
  expect(isRetiredScreen("sync")).toBe(true);
  expect(isRetiredScreen("security")).toBe(true);
});

test("their real hashes, sub-paths and run, skill and changes tabs lead back home too", () => {
  for (const hash of [
    "#/agents/queue",
    "#/agents/skills",
    "#/settings/components",
    "#/agents/",
    "#/skills/superpowers%3Abrainstorming",
    "#/runs/r1",
    "#/p/silo/changes",
    "#/p/silo/changes?wt=feat",
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
    "#/p/silo/",
    "#/p/silo/page1",
    "#/p/silo/t/SILO-12",
    "#/p/silo/file?path=README.md",
    "#/codex",
  ])
    expect([hash, retiredRoute(hash)]).toEqual([hash, null]);
});

test("retired screens and the hashes of run, skill and changes tabs", () => {
  const retired: Screen[] = ["agents", "queue", "skills", "creations", "components", "sources", "domains"];
  expect(retired.every(isRetiredScreen)).toBe(true);
  expect(isRetiredScreen("general")).toBe(false);
  const home = (hash: string) => retiredRoute(hash) !== null;
  expect(home(targetToHash({ kind: "changes", projectId: "p1", worktree: null }))).toBe(true);
  expect(home(targetToHash({ kind: "run", runId: "r1" }))).toBe(true);
  expect(home(targetToHash({ kind: "skill", skillId: "s" }))).toBe(true);
  expect(home(targetToHash({ kind: "ticket", projectId: "p1", ticketId: "t1" }))).toBe(false);
  expect(home(targetToHash({ kind: "screen", screen: "inbox" }))).toBe(false);
});
