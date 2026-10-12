import { expect, spyOn, test } from "bun:test";
import { DEFAULT_AGENT_SETTINGS } from "@kibo/schema";
import { createAgentSettingsStore } from "./settings-store";
import { makeTestHome } from "./test-home.test-helper";

const setup = () => {
  const h = makeTestHome();
  let clock = 10;
  return { h, store: createAgentSettingsStore(h.db, () => clock++) };
};

test("an agent without a row has the defaults", () => {
  const { store } = setup();
  expect(store.get("global:a")).toEqual(DEFAULT_AGENT_SETTINGS);
  expect(store.getStored("global:a")).toBeNull();
});

test("a partial patch merges with the stored settings and stamps the row", () => {
  const { h, store } = setup();
  store.set("global:a", { maxParallel: 3 });
  expect(store.set("global:a", { permissionMode: "plan" })).toEqual({
    ...DEFAULT_AGENT_SETTINGS,
    maxParallel: 3,
    permissionMode: "plan",
  });
  expect(store.getStored("global:a")).toEqual({ maxParallel: 3, permissionMode: "plan" });
  expect(h.db.query("SELECT updated_at FROM agent_settings").get()).toEqual({ updated_at: 11 });
});

test("a Kibo agent keeps its fixed settings", () => {
  const { store } = setup();
  store.set("system:generateur", { maxParallel: 3, enabled: false });
  expect(store.get("system:generateur")).toMatchObject({
    workspace: "isolated",
    maxParallel: 3,
    enabled: false,
  });
  expect(store.get("system:demo").maxParallel).toBe(1);
});

test("move, remove and citing", () => {
  const { store } = setup();
  store.set("global:a", { maxParallel: 2 });
  store.set("global:chef", { subagents: ["global:b", "global:a"] });
  store.set("global:autre", { subagents: ["global:c"] });
  expect(store.citing("global:a")).toEqual(["global:chef"]);
  store.move("global:a", "global:z");
  expect(store.getStored("global:a")).toBeNull();
  expect(store.get("global:z").maxParallel).toBe(2);
  store.remove("global:z");
  expect(store.getStored("global:z")).toBeNull();
});

test("a corrupt row falls back to the defaults and is reported", () => {
  const { h, store } = setup();
  const errors = spyOn(console, "error").mockImplementation(() => undefined);
  h.db.query("INSERT INTO agent_settings (ref, json, updated_at) VALUES ('global:a', '{bad', 1)").run();
  expect(store.get("global:a")).toEqual(DEFAULT_AGENT_SETTINGS);
  expect(errors).toHaveBeenCalled();
  errors.mockRestore();
});
