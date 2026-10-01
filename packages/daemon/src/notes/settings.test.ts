import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createProjectSettings, ensureSettingsTable } from "./settings";

const open = () => {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  return createProjectSettings(db);
};

test("unset removes one key of one project and tolerates an absent key", () => {
  const settings = open();
  settings.set("p1", "folder", "/tmp/a");
  settings.set("p1", "notesDir", "/tmp/n");
  settings.set("p2", "folder", "/tmp/b");
  settings.unset("p1", "folder");
  expect(settings.get("p1", "folder")).toBeNull();
  expect(settings.get("p1", "notesDir")).toBe("/tmp/n");
  expect(settings.get("p2", "folder")).toBe("/tmp/b");
  settings.unset("p1", "folder");
});

test("remove drops every key of a project and nothing else", () => {
  const settings = open();
  settings.set("p1", "folder", "/tmp/a");
  settings.set("p1", "notesDir", "/tmp/n");
  settings.set("p2", "folder", "/tmp/b");
  settings.remove("p1");
  expect(settings.get("p1", "folder")).toBeNull();
  expect(settings.get("p1", "notesDir")).toBeNull();
  expect(settings.get("p2", "folder")).toBe("/tmp/b");
  settings.remove("p1");
});
