import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createAppSettingsStore } from "./app-settings-store";

const open = (now = () => 1_000) => {
  const db = new Database(":memory:", { strict: true });
  return { db, store: createAppSettingsStore(db, now) };
};

test("agent execution is always hidden", () => {
  const { store } = open();
  expect(store.get()).toEqual({ agentExecution: "hidden" });
  expect(store.set({})).toEqual({ agentExecution: "hidden" });
});

test("a shown value stored before the lock is read as hidden and left in place", () => {
  const { db, store } = open();
  db.query(
    "INSERT INTO app_settings (key, json, updated_at) VALUES ('agentExecution', '\"shown\"', 1)",
  ).run();
  expect(store.get()).toEqual({ agentExecution: "hidden" });
  expect(createAppSettingsStore(db, () => 0).get()).toEqual({ agentExecution: "hidden" });
  expect(db.query("SELECT key, json FROM app_settings").all()).toEqual([
    { key: "agentExecution", json: '"shown"' },
  ]);
});

test("an unreadable stored execution value is ignored like any other", () => {
  const { db, store } = open();
  db.query("INSERT INTO app_settings (key, json, updated_at) VALUES ('agentExecution', '{', 1)").run();
  expect(store.get()).toEqual({ agentExecution: "hidden" });
});

test("another stored value that cannot be read is reported as a corrupt store", () => {
  const { db, store } = open();
  db.query("INSERT INTO app_settings (key, json, updated_at) VALUES ('future', '{', 1)").run();
  expect(() => store.get()).toThrow("STORE_CORRUPT");
});
