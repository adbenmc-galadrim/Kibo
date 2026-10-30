import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openWakeupStore, type WakeupStore } from "./store";

const dirs: string[] = [];
const home = () => {
  const d = mkdtempSync(join(tmpdir(), "kibo-wakeup-store-"));
  dirs.push(d);
  return d;
};
const stores: WakeupStore[] = [];
const open = (h: string) => {
  const store = openWakeupStore(h);
  stores.push(store);
  return store;
};
afterEach(() => {
  for (const s of stores.splice(0)) s.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("wake-ups default to nothing, round-trip, and the due ones are listed", () => {
  const store = open(home());
  expect(store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: null, dueAt: null });
  store.saveWakeup({ projectId: "p1", lastAt: 100, dueAt: 700 });
  store.saveWakeup({ projectId: "p2", lastAt: 100, dueAt: null });
  expect(store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: 100, dueAt: 700 });
  expect(store.due()).toEqual([{ projectId: "p1", lastAt: 100, dueAt: 700 }]);
  store.saveWakeup({ projectId: "p1", lastAt: 700, dueAt: null });
  expect(store.wakeup("p1")).toEqual({ projectId: "p1", lastAt: 700, dueAt: null });
  expect(store.due()).toEqual([]);
});

test("answers wait once per question, per project, and survive a reopening", () => {
  const h = home();
  const store = open(h);
  store.queueAnswer("p1", "q1", 10);
  store.queueAnswer("p1", "q2", 20);
  store.queueAnswer("p1", "q1", 30);
  store.queueAnswer("p2", "q9", 5);
  expect(store.queuedAnswers("p1")).toEqual(["q1", "q2"]);
  expect(store.queuedAnswers("p3")).toEqual([]);
  expect(open(h).queuedAnswers("p1")).toEqual(["q1", "q2"]);
  store.dropAnswers("p1");
  expect(store.queuedAnswers("p1")).toEqual([]);
  expect(store.queuedAnswers("p2")).toEqual(["q9"]);
});
