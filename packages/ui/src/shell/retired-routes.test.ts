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

test("retired screens, and the hashes of the run, skill and changes tabs", () => {
  const retired: Screen[] = ["components", "sources", "domains"];
  expect(retired.every(isRetiredScreen)).toBe(true);
  expect(isRetiredScreen("general")).toBe(false);
  const home = (hash: string) => retiredRoute(hash) !== null;
  for (const hash of [
    "#/agents",
    "#/agents/queue",
    "#/agents/skills",
    "#/runs/r1",
    "#/skills/s",
    "#/p/p1/changes",
  ])
    expect([hash, home(hash)]).toEqual([hash, true]);
  expect(home(targetToHash({ kind: "ticket", projectId: "p1", ticketId: "t1" }))).toBe(false);
  expect(home(targetToHash({ kind: "screen", screen: "inbox" }))).toBe(false);
});
