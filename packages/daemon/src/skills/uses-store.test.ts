import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { join } from "node:path";
import type { RunAction } from "@kibo/schema";
import { openRunStore } from "../agents/run-store";
import { cleanSkillDirs, tempDir } from "./fakes.test-helper";
import { createSkillUses } from "./uses-store";

cleanSkillDirs();

const action = (kind: RunAction["kind"], target: string | null, callId?: string): RunAction => ({
  tool: kind === "skill" ? "Skill" : "Read",
  kind,
  label: "A fait",
  target,
  outcome: "ok",
  detail: null,
  patch: null,
  tests: null,
  ...(callId === undefined ? {} : { callId }),
});

function rig() {
  const home = tempDir();
  const runs = openRunStore(home);
  const db = new Database(join(home, "runs.db"), { strict: true });
  return { uses: createSkillUses(db), runs, db };
}

test("skill actions are counted per skill, other actions are ignored", () => {
  const { uses } = rig();
  uses.record(
    "r1",
    [action("skill", "a", "t1"), action("skill", "a", "t2"), action("skill", "b"), action("read", "x")],
    10,
  );
  expect(uses.byRun("r1")).toEqual([
    { skillId: "a", count: 2 },
    { skillId: "b", count: 1 },
  ]);
});

test("a call already seen is not counted twice, a call without id always is", () => {
  const { uses } = rig();
  uses.record("r1", [action("skill", "a", "t1")], 10);
  uses.record("r1", [action("skill", "a", "t1")], 11);
  uses.record("r1", [action("skill", "a")], 12);
  uses.record("r2", [action("skill", "a", "t1")], 13);
  expect(uses.byRun("r1")).toEqual([{ skillId: "a", count: 2 }]);
  expect(uses.byRun("r2")).toEqual([{ skillId: "a", count: 1 }]);
});

test("a skill action without target or with an invalid id is ignored", () => {
  const { uses } = rig();
  uses.record("r1", [action("skill", null, "t1"), action("skill", "Bad Id", "t2")], 10);
  expect(uses.byRun("r1")).toEqual([]);
});

test("usage gives the last run with its ticket and the runs of the period", () => {
  const { uses, runs } = rig();
  runs.create(
    {
      id: "r2",
      kind: "ticket",
      projectId: "p1",
      ticketId: "t1",
      ticketKey: "KIB-14",
      ticketTitle: "Récepteur",
      profileId: "global:livraison",
      profileName: "livraison",
      agentScope: "global",
      projectKey: "KIB",
      sessionId: "s2",
      brief: "",
      resumedFrom: null,
    },
    0,
    1,
  );
  uses.record("r1", [action("skill", "a", "t1")], 100);
  uses.record("r2", [action("skill", "a", "t2")], 200);
  uses.record("r3", [action("skill", "a", "t3")], 50);
  expect(uses.usage("a", 60)).toEqual({ last: { runId: "r2", ticketKey: "KIB-14", at: 200 }, runs30d: 2 });
  expect(uses.usage("a", 300)).toEqual({ last: { runId: "r2", ticketKey: "KIB-14", at: 200 }, runs30d: 0 });
  expect(uses.usage("zzz", 0)).toEqual({ last: null, runs30d: 0 });
});

test("usage of a run unknown to the run store has no ticket", () => {
  const { uses } = rig();
  uses.record("ghost", [action("skill", "a", "t1")], 100);
  expect(uses.usage("a", 0).last).toEqual({ runId: "ghost", ticketKey: null, at: 100 });
});

test("a skill refused by the guard is not a use", () => {
  const { uses } = rig();
  uses.record("r1", [{ ...action("skill", "deploy", "t1"), outcome: "denied" }], 10);
  expect(uses.byRun("r1")).toEqual([]);
  expect(uses.usage("deploy", 0)).toEqual({ last: null, runs30d: 0 });
});
