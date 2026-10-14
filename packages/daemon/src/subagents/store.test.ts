import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import type { SubagentRow } from "@kibo/schema";
import { createSubagentStore } from "./store";

const ROW: SubagentRow = {
  id: "a1",
  runId: "r1",
  toolUseId: "toolu_1",
  type: "ecc:code-reviewer",
  description: "Porte qualité — correctness",
  prompt: "Relis le diff",
  model: "opus",
  parentId: null,
  transcriptPath: "/p/s1/subagents/agent-a1.jsonl",
  startedAt: 100,
};

test("a subagent row is frozen once created", () => {
  const db = new Database(":memory:", { strict: true });
  const store = createSubagentStore(db);
  store.create(ROW);
  expect(() => store.create({ ...ROW, type: "Explore" })).toThrow(
    expect.objectContaining({ code: "CONFLICT" }),
  );
  expect(() => db.exec("UPDATE run_subagents SET type = 'Explore'")).toThrow();
  store.append("a1", { type: "started", at: 1 });
  expect(() => db.exec("DELETE FROM run_subagent_events")).toThrow();
  expect(() => db.exec("DELETE FROM run_subagents")).toThrow();
  expect(store.get("a1")).toEqual(ROW);
  expect(store.get("a2")).toBeNull();
});

test("events fold into the listed subagent", () => {
  const store = createSubagentStore(new Database(":memory:", { strict: true }), () => ({
    actions: 4,
    lastText: "Rien à signaler",
  }));
  store.create({ ...ROW, toolUseId: null, description: "" });
  store.append("a1", { type: "started", at: 110 });
  store.append("a1", { type: "linked", at: 111, facts: { toolUseId: "toolu_1", description: "Repérage" } });
  store.append("a1", { type: "ended", at: 400, isError: false, result: "RAS" });
  expect(store.events("a1").map((e) => e.type)).toEqual(["started", "linked", "ended"]);
  expect(store.list("r1")).toEqual([
    {
      ...ROW,
      description: "Repérage",
      state: "done",
      startedAt: 110,
      endedAt: 400,
      result: "Rien à signaler",
      actions: 4,
    },
  ]);
  expect(store.list("r2")).toEqual([]);
  expect(store.byToolUse("r1", "toolu_1")).toBe("a1");
  expect(store.byToolUse("r1", "toolu_9")).toBeNull();
});

test("the tool use of a row is found without a link", () => {
  const store = createSubagentStore(new Database(":memory:", { strict: true }));
  store.create(ROW);
  expect(store.byToolUse("r1", "toolu_1")).toBe("a1");
  expect(store.byToolUse("r2", "toolu_1")).toBeNull();
});

test("the reading offset of a subagent transcript is kept", () => {
  const store = createSubagentStore(new Database(":memory:", { strict: true }));
  expect(store.trace("a1")).toBeNull();
  store.saveTrace({ subagentId: "a1", runId: "r1", path: "/p/agent-a1.jsonl", offset: 42, closedAt: null });
  store.saveTrace({ subagentId: "a1", runId: "r1", path: "/p/agent-a1.jsonl", offset: 84, closedAt: 9 });
  expect(store.trace("a1")).toEqual({
    subagentId: "a1",
    runId: "r1",
    path: "/p/agent-a1.jsonl",
    offset: 84,
    closedAt: 9,
  });
});

test("the tables can be created twice", () => {
  const db = new Database(":memory:", { strict: true });
  createSubagentStore(db);
  expect(() => createSubagentStore(db)).not.toThrow();
});
