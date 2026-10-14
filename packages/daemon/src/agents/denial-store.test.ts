import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import type { DenialItem } from "@kibo/schema";
import { denialStore } from "./denial-store";

const ITEM: DenialItem = {
  tool: "Bash",
  target: "pnpm test",
  rule: "Bash(pnpm *)",
  addDir: null,
  reason: "ok",
};
const open = () => denialStore(new Database(":memory:", { strict: true }));

test("the last turn of a run is read back with its items and question", () => {
  const store = open();
  expect(store.get("r1")).toBeNull();
  expect(store.lastSeq("r1")).toBe(-1);
  store.save({ runId: "r1", turn: 1, items: [ITEM], questionId: "q1", seq: 4, at: 10 });
  store.save({
    runId: "r1",
    turn: 2,
    items: [ITEM, { ...ITEM, rule: "Bash(git *)" }],
    questionId: null,
    seq: 9,
    at: 20,
  });
  store.save({ runId: "r2", turn: 1, items: [ITEM], questionId: "q3", seq: 2, at: 30 });
  expect(store.get("r1")).toEqual({
    runId: "r1",
    turn: 2,
    items: [ITEM, { ...ITEM, rule: "Bash(git *)" }],
    questionId: null,
    at: 20,
  });
  expect(store.lastSeq("r1")).toBe(9);
  expect(store.get("r2")?.questionId).toBe("q3");
});

test("a second save of the same turn is a conflict", () => {
  const store = open();
  store.save({ runId: "r1", turn: 1, items: [ITEM], questionId: "q1", seq: 4, at: 10 });
  expect(() => store.save({ runId: "r1", turn: 1, items: [], questionId: null, seq: 5, at: 11 })).toThrow(
    expect.objectContaining({ code: "CONFLICT" }),
  );
  expect(store.get("r1")?.questionId).toBe("q1");
});

test("a corrupt row is reported, never ignored", () => {
  const db = new Database(":memory:", { strict: true });
  const store = denialStore(db);
  db.query(
    "INSERT INTO run_denials (run_id, turn, items, question_id, seq, at) VALUES ('r1', 1, '[{}]', NULL, 0, 1)",
  ).run();
  expect(() => store.get("r1")).toThrow(expect.objectContaining({ code: "STORE_CORRUPT" }));
});
