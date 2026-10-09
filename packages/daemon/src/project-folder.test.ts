import { Database } from "bun:sqlite";
import { expect, spyOn, test } from "bun:test";
import { STORYBOOK_DEFAULTS } from "@kibo/schema";
import { createProjectSettings, ensureSettingsTable } from "./notes/settings";
import {
  LOCAL_FOLDER_KEY,
  LOCAL_STORYBOOK_KEY,
  LOCAL_WORKTREE_KEY,
  localStorybook,
  storybookSettingsOf,
  withLocalSettings,
} from "./project-folder";

const meta = {
  id: "p1",
  key: "KIB",
  name: "Kibo",
  folder: null,
  color: "#14B8A6",
  worktree: null,
  storybook: null,
};

test("a shared project gets its folder back from the local settings", () => {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  const settings = createProjectSettings(db);
  expect(withLocalSettings(meta, settings, false).folder).toBeNull();
  settings.set("p1", LOCAL_FOLDER_KEY, "/Users/adam/goinfre/Kibo");
  expect(withLocalSettings(meta, settings, true).folder).toBe("/Users/adam/goinfre/Kibo");
  expect(withLocalSettings({ ...meta, folder: "/ailleurs" }, settings, true).folder).toBe(
    "/Users/adam/goinfre/Kibo",
  );
});

test("a shared project never takes its folder from the doc", () => {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  const settings = createProjectSettings(db);
  expect(withLocalSettings({ ...meta, folder: "/tmp/evil" }, settings, true).folder).toBeNull();
  expect(withLocalSettings({ ...meta, folder: "/Users/adam/Perso" }, settings, false).folder).toBe(
    "/Users/adam/Perso",
  );
});

const worktree = { baseRef: "origin/dev", pathTemplate: "../emis-{slug}", setup: "pnpm worktree {branch}" };

function localSettings() {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  return createProjectSettings(db);
}

test("worktree settings come from the local settings only, shared or not", () => {
  const settings = localSettings();
  expect(withLocalSettings({ ...meta, worktree }, settings, false).worktree).toBeNull();
  settings.set("p1", LOCAL_WORKTREE_KEY, JSON.stringify(worktree));
  expect(withLocalSettings(meta, settings, false).worktree).toEqual(worktree);
  expect(withLocalSettings(meta, settings, true).worktree).toEqual(worktree);
});

test("corrupt worktree settings are ignored with a warning, never thrown", () => {
  const settings = localSettings();
  const warn = spyOn(console, "error").mockImplementation(() => {});
  try {
    for (const raw of ["{not json", JSON.stringify({ ...worktree, pathTemplate: "" }), "null"]) {
      settings.set("p1", LOCAL_WORKTREE_KEY, raw);
      expect(withLocalSettings(meta, settings, false).worktree).toBeNull();
    }
    expect(warn).toHaveBeenCalledTimes(3);
  } finally {
    warn.mockRestore();
  }
});

const storybook = { origin: "https://sb.example.com", portEnv: "SB_PORT" };

test("storybook settings come from the local settings only, shared or not", () => {
  const settings = localSettings();
  expect(localStorybook(settings, "p1")).toBeNull();
  expect(withLocalSettings({ ...meta, storybook }, settings, false).storybook).toBeNull();
  settings.set("p1", LOCAL_STORYBOOK_KEY, JSON.stringify(storybook));
  expect(localStorybook(settings, "p1")).toEqual(storybook);
  expect(withLocalSettings(meta, settings, false).storybook).toEqual(storybook);
  expect(withLocalSettings(meta, settings, true).storybook).toEqual(storybook);
});

test("corrupt storybook settings are ignored with a warning and fall back to the defaults", () => {
  const settings = localSettings();
  const warn = spyOn(console, "error").mockImplementation(() => {});
  try {
    for (const raw of [
      "{not json",
      JSON.stringify({ ...storybook, origin: "http://192.168.1.10:6006" }),
      "null",
    ]) {
      settings.set("p1", LOCAL_STORYBOOK_KEY, raw);
      expect(localStorybook(settings, "p1")).toBeNull();
      expect(storybookSettingsOf(settings, "p1")).toEqual(STORYBOOK_DEFAULTS);
    }
    expect(warn).toHaveBeenCalledTimes(6);
  } finally {
    warn.mockRestore();
  }
});

test("a project without storybook settings uses the defaults", () => {
  expect(storybookSettingsOf(localSettings(), "p1")).toEqual(STORYBOOK_DEFAULTS);
});
