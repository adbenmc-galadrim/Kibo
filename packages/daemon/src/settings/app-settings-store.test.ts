import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createAppSettingsStore } from "./app-settings-store";

const open = (now = () => 1_000) => {
  const db = new Database(":memory:", { strict: true });
  return { db, store: createAppSettingsStore(db, now) };
};

test("agent execution is hidden until it is shown", () => {
  const { store } = open();
  expect(store.get()).toEqual({ agentExecution: "hidden" });
});

test("a patch is persisted with its date and survives a reopening", () => {
  let now = 1_000;
  const { db, store } = open(() => now);
  now = 2_000;
  expect(store.set({ agentExecution: "shown" })).toEqual({ agentExecution: "shown" });
  expect(createAppSettingsStore(db, () => 0).get()).toEqual({ agentExecution: "shown" });
  expect(db.query("SELECT key, json, updated_at FROM app_settings").all()).toEqual([
    { key: "agentExecution", json: '"shown"', updated_at: 2_000 },
  ]);
  expect(store.set({})).toEqual({ agentExecution: "shown" });
});

test("a stored value that cannot be read is reported as a corrupt store", () => {
  const { db, store } = open();
  db.query("INSERT INTO app_settings (key, json, updated_at) VALUES ('agentExecution', '{', 1)").run();
  expect(() => store.get()).toThrow("STORE_CORRUPT");
  db.query("UPDATE app_settings SET json = '\"maybe\"'").run();
  expect(() => store.get()).toThrow("STORE_CORRUPT");
});
