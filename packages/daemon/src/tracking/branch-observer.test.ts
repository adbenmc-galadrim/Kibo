import { afterEach, beforeEach, expect, test } from "bun:test";
import { observeBranches } from "./branch-observer";
import { createObserverFixture, type ObserverFixture } from "./observer-fixture.test-helper";

let fx: ObserverFixture;
let branches: string[];
let logged: string[];
let state: Map<string, string>;

beforeEach(() => {
  fx = createObserverFixture(34);
  branches = ["main"];
  logged = [];
  state = new Map();
});
afterEach(() => fx.close());

const observe = () =>
  observeBranches(
    { service: fx.service, refs: async () => branches, log: (what) => () => void logged.push(what) },
    state,
  );

test("a new branch naming a ticket links it with origin kibo and starts it", async () => {
  branches = ["feat/emis-33-envoi-hors-ligne", "main"];
  await observe();
  expect(fx.ticket("EMIS-33").externalRefs).toEqual([
    { kind: "git_branch", branch: "feat/emis-33-envoi-hors-ligne", base: null },
  ]);
  expect(fx.ticket("EMIS-33").statusId).toBe("in_progress");
  const link = fx.events.find((e) => e.command.method === "upsertExternalRef");
  expect(link?.meta.origin).toBe("kibo");
  expect(fx.ticket("EMIS-3").statusId).toBe("todo");
});

test("a declared branch is recognised even without the key in its name", async () => {
  fx.declare("EMIS-5", "feat/photos");
  branches = ["feat/photos", "main"];
  await observe();
  expect(fx.ticket("EMIS-5").statusId).toBe("in_progress");
  expect(fx.events.filter((e) => e.meta.origin === "kibo")).toHaveLength(0);
});

test("a declared branch that does not exist yet starts nothing", async () => {
  fx.declare("EMIS-5", "feat/photos");
  await observe();
  expect(fx.ticket("EMIS-5").statusId).toBe("todo");
});

test("keys match between word bounds, case ignored", async () => {
  branches = ["feat/emis-3", "fix/EMIS-33-bis"];
  await observe();
  expect(fx.branchOf("EMIS-3")).toBe("feat/emis-3");
  expect(fx.branchOf("EMIS-33")).toBe("fix/EMIS-33-bis");
  expect(fx.branchOf("EMIS-30")).toBeNull();
  expect(fx.ticket("EMIS-30").statusId).toBe("todo");
});

test("a branch naming two tickets links none and is logged", async () => {
  branches = ["feat/emis-3-et-emis-30"];
  await observe();
  expect(fx.branchOf("EMIS-3")).toBeNull();
  expect(fx.branchOf("EMIS-30")).toBeNull();
  expect(logged).toEqual(["branch feat/emis-3-et-emis-30 names several tickets, not linked"]);
});

test("a ticket in review, blocked or done keeps its status", async () => {
  fx.setStatus("EMIS-1", "in_review");
  fx.setStatus("EMIS-2", "done");
  fx.setStatus("EMIS-4", "blocked", "attend Q14");
  branches = ["feat/emis-1-a", "feat/emis-2-b", "feat/emis-4-c"];
  await observe();
  expect(fx.ticket("EMIS-1").statusId).toBe("in_review");
  expect(fx.ticket("EMIS-2").statusId).toBe("done");
  expect(fx.ticket("EMIS-4").statusId).toBe("blocked");
});

test("a ticket that already has a branch keeps it", async () => {
  fx.declare("EMIS-7", "feat/emis-7-a");
  branches = ["feat/emis-7-a", "feat/emis-7-b"];
  await observe();
  expect(fx.branchOf("EMIS-7")).toBe("feat/emis-7-a");
});

test("unchanged refs produce no command, a deleted branch changes nothing", async () => {
  branches = ["feat/emis-33-envoi-hors-ligne", "main"];
  await observe();
  const after = fx.events.length;
  await observe();
  expect(fx.events.length).toBe(after);
  fx.setStatus("EMIS-33", "todo");
  const moved = fx.events.length;
  await observe();
  expect(fx.events.length).toBe(moved);
  branches = ["main"];
  await observe();
  expect(fx.events.length).toBe(moved);
  expect(fx.branchOf("EMIS-33")).toBe("feat/emis-33-envoi-hors-ligne");
  expect(fx.ticket("EMIS-33").statusId).toBe("todo");
});

test("a branch declared after it was seen starts the ticket on the next pass", async () => {
  branches = ["feat/photos", "main"];
  await observe();
  fx.declare("EMIS-5", "feat/photos");
  await observe();
  expect(fx.ticket("EMIS-5").statusId).toBe("in_progress");
});

test("each project keeps its own signature", async () => {
  branches = ["feat/emis-9-a"];
  await observe();
  expect([...state.keys()]).toEqual([fx.projectId]);
});
