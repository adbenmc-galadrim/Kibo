import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createAppSettingsStore } from "./app-settings-store";

const open = (now = () => 1_000) => {
  const db = new Database(":memory:", { strict: true });
  return { db, store: createAppSettingsStore(db, now) };
};

test("the app settings are empty", () => {
  const { store } = open();
  expect(store.get()).toEqual({});
  expect(store.set({})).toEqual({});
});

test("an agent execution value stored before its removal is ignored and left in place", () => {
  const { db, store } = open();
  db.query(
    "INSERT INTO app_settings (key, json, updated_at) VALUES ('agentExecution', '\"shown\"', 1)",
  ).run();
  expect(store.get()).toEqual({});
  expect(createAppSettingsStore(db, () => 0).get()).toEqual({});
  expect(db.query("SELECT key, json FROM app_settings").all()).toEqual([
    { key: "agentExecution", json: '"shown"' },
  ]);
});

test("a stored value that cannot be read is reported as a corrupt store", () => {
  const { db, store } = open();
  db.query("INSERT INTO app_settings (key, json, updated_at) VALUES ('future', '{', 1)").run();
  expect(() => store.get()).toThrow("STORE_CORRUPT");
});
