import { afterEach, expect, test } from "bun:test";
import type { TabTarget } from "@kibo/schema";
import { cleanup, render } from "@testing-library/react";
import { RetiredRedirect } from "./RetiredRedirect";

afterEach(() => {
  cleanup();
  history.replaceState(null, "", "#/");
});

const homes = (target: TabTarget | null, hash = "#/") => {
  history.replaceState(null, "", hash);
  let count = 0;
  render(<RetiredRedirect target={target} onHome={() => count++} />);
  return count;
};

test("a retired screen or tab sends back home", () => {
  expect(homes({ kind: "screen", screen: "domains" })).toBeGreaterThan(0);
  expect(homes({ kind: "screen", screen: "components" })).toBeGreaterThan(0);
  expect(homes({ kind: "screen", screen: "sources" })).toBeGreaterThan(0);
});

test("an old URL that no tab understands sends back home", () => {
  expect(homes(null, "#/code")).toBeGreaterThan(0);
  expect(homes({ kind: "page", projectId: "p1", pageId: "g1" }, "#/queue")).toBeGreaterThan(0);
});

test("the tracking screens stay where they are", () => {
  expect(homes(null)).toBe(0);
  expect(homes({ kind: "screen", screen: "inbox" }, "#/inbox")).toBe(0);
  expect(homes({ kind: "ticket", projectId: "p1", ticketId: "t1" }, "#/p/p1/t/t1")).toBe(0);
});

test("an old URL gives way to the home URL even when home is already shown", () => {
  homes(null, "#/code");
  expect(location.hash).toBe("#/");
});

test("an old agents, run, skill or changes URL sends back home", () => {
  expect(homes(null, "#/agents")).toBeGreaterThan(0);
  expect(homes(null, "#/agents/queue")).toBeGreaterThan(0);
  expect(homes(null, "#/runs/r1")).toBeGreaterThan(0);
  expect(homes(null, "#/skills/superpowers%3Abrainstorming")).toBeGreaterThan(0);
  expect(homes(null, "#/p/p1/changes")).toBeGreaterThan(0);
  expect(homes(null, "#/p/p1/changes?wt=%2Ftmp%2Fwt")).toBeGreaterThan(0);
});

test("an old URL typed once the shell is shown sends back home too", () => {
  history.replaceState(null, "", "#/inbox");
  let count = 0;
  render(<RetiredRedirect target={null} onHome={() => count++} />);
  expect(count).toBe(0);
  history.replaceState(null, "", "#/agents");
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  expect(count).toBe(1);
  expect(location.hash).toBe("#/");
});
