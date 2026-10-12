import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { DEFAULT_DUPLICATION_SETTINGS } from "@kibo/schema";
import { createProjectSettings, ensureSettingsTable } from "../notes/settings";
import { LOCAL_DUPLICATION_KEY } from "../project-folder";
import { duplicationSettings } from "./settings";

test("the detector reads the local settings of a project, or the defaults", () => {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  const settings = createProjectSettings(db);
  const of = duplicationSettings(settings);
  expect(of("p1")).toEqual(DEFAULT_DUPLICATION_SETTINGS);
  const custom = { ...DEFAULT_DUPLICATION_SETTINGS, enabled: false, minLines: 12 };
  settings.set("p1", LOCAL_DUPLICATION_KEY, JSON.stringify(custom));
  expect(of("p1")).toEqual(custom);
  expect(of("p2")).toEqual(DEFAULT_DUPLICATION_SETTINGS);
});
