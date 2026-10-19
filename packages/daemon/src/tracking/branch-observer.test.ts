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
  branches = ["feat/silo-33-envoi-hors-ligne", "main"];
  await observe();
  expect(fx.ticket("SILO-33").externalRefs).toEqual([
    { kind: "git_branch", branch: "feat/silo-33-envoi-hors-ligne", base: null },
  ]);
  expect(fx.ticket("SILO-33").statusId).toBe("in_progress");
  const link = fx.events.find((e) => e.command.method === "upsertExternalRef");
  expect(link?.meta.origin).toBe("kibo");
  expect(fx.ticket("SILO-3").statusId).toBe("todo");
});

test("a declared branch is recognised even without the key in its name", async () => {
  fx.declare("SILO-5", "feat/photos");
  branches = ["feat/photos", "main"];
  await observe();
  expect(fx.ticket("SILO-5").statusId).toBe("in_progress");
  expect(fx.events.filter((e) => e.meta.origin === "kibo")).toHaveLength(0);
});

test("a declared branch that does not exist yet starts nothing", async () => {
  fx.declare("SILO-5", "feat/photos");
  await observe();
  expect(fx.ticket("SILO-5").statusId).toBe("todo");
});

test("keys match between word bounds, case ignored", async () => {
  branches = ["feat/silo-3", "fix/SILO-33-bis"];
  await observe();
  expect(fx.branchOf("SILO-3")).toBe("feat/silo-3");
  expect(fx.branchOf("SILO-33")).toBe("fix/SILO-33-bis");
  expect(fx.branchOf("SILO-30")).toBeNull();
  expect(fx.ticket("SILO-30").statusId).toBe("todo");
});

test("a branch naming two tickets links none and is logged", async () => {
  branches = ["feat/silo-3-et-silo-30"];
  await observe();
  expect(fx.branchOf("SILO-3")).toBeNull();
  expect(fx.branchOf("SILO-30")).toBeNull();
  expect(logged).toEqual(["ambiguous branch"]);
});

test("a ticket in review, blocked or done keeps its status", async () => {
  fx.setStatus("SILO-1", "in_review");
  fx.setStatus("SILO-2", "done");
  fx.setStatus("SILO-4", "blocked", "attend Q14");
  branches = ["feat/silo-1-a", "feat/silo-2-b", "feat/silo-4-c"];
  await observe();
  expect(fx.ticket("SILO-1").statusId).toBe("in_review");
  expect(fx.ticket("SILO-2").statusId).toBe("done");
  expect(fx.ticket("SILO-4").statusId).toBe("blocked");
});

test("a ticket that already has a branch keeps it", async () => {
  fx.declare("SILO-7", "feat/silo-7-a");
  branches = ["feat/silo-7-a", "feat/silo-7-b"];
  await observe();
  expect(fx.branchOf("SILO-7")).toBe("feat/silo-7-a");
});

test("unchanged refs produce no command, a deleted branch changes nothing", async () => {
  branches = ["feat/silo-33-envoi-hors-ligne", "main"];
  await observe();
  const after = fx.events.length;
  await observe();
  expect(fx.events.length).toBe(after);
  fx.setStatus("SILO-33", "todo");
  const moved = fx.events.length;
  await observe();
  expect(fx.events.length).toBe(moved);
  branches = ["main"];
  await observe();
  expect(fx.events.length).toBe(moved);
  expect(fx.branchOf("SILO-33")).toBe("feat/silo-33-envoi-hors-ligne");
  expect(fx.ticket("SILO-33").statusId).toBe("todo");
});

test("a branch declared after it was seen starts the ticket on the next pass", async () => {
  branches = ["feat/photos", "main"];
  await observe();
  fx.declare("SILO-5", "feat/photos");
  await observe();
  expect(fx.ticket("SILO-5").statusId).toBe("in_progress");
});

test("each project keeps its own signature", async () => {
  branches = ["feat/silo-9-a"];
  await observe();
  expect([...state.keys()]).toEqual([fx.projectId]);
});

test("a done ticket is never linked by name and does not restart when reopened", async () => {
  fx.setStatus("SILO-8", "done");
  branches = ["feat/silo-8-ancienne"];
  await observe();
  expect(fx.branchOf("SILO-8")).toBeNull();
  fx.setStatus("SILO-8", "todo");
  await observe();
  expect(fx.ticket("SILO-8").statusId).toBe("todo");
  expect(fx.events.filter((e) => e.meta.origin === "kibo")).toHaveLength(0);
});

test("a done ticket does not make a branch ambiguous", async () => {
  fx.setStatus("SILO-3", "done");
  branches = ["feat/silo-3-et-silo-30"];
  await observe();
  expect(fx.branchOf("SILO-3")).toBeNull();
  expect(fx.branchOf("SILO-30")).toBe("feat/silo-3-et-silo-30");
});

test("an ambiguous branch is logged with an error naming it", async () => {
  const errors: unknown[] = [];
  branches = ["feat/silo-3-et-silo-30"];
  await observeBranches(
    { service: fx.service, refs: async () => branches, log: () => (e) => void errors.push(e) },
    state,
  );
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBeInstanceOf(Error);
  expect(String(errors[0])).toContain("feat/silo-3-et-silo-30");
});
