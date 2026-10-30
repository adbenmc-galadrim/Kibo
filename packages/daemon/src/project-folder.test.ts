import { Database } from "bun:sqlite";
import { expect, spyOn, test } from "bun:test";
import { STORYBOOK_DEFAULTS } from "@kibo/schema";
import { createProjectSettings, ensureSettingsTable } from "./notes/settings";
import {
  LOCAL_DUPLICATION_KEY,
  LOCAL_FOLDER_KEY,
  LOCAL_STORYBOOK_KEY,
  LOCAL_WORKTREE_KEY,
  localDuplication,
  localFolder,
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
  duplication: null,
  delivery: null,
  tracking: null,
  description: null,
  client: null,
};

test("the local folder wins over the folder of the doc", () => {
  const settings = localSettings();
  expect(withLocalSettings(meta, settings).folder).toBeNull();
  expect(withLocalSettings({ ...meta, folder: "/Users/adam/Perso" }, settings).folder).toBe(
    "/Users/adam/Perso",
  );
  settings.set("p1", LOCAL_FOLDER_KEY, "/Users/adam/goinfre/Kibo");
  expect(withLocalSettings({ ...meta, folder: "/ailleurs" }, settings).folder).toBe(
    "/Users/adam/goinfre/Kibo",
  );
});

const worktree = {
  baseRef: "origin/dev",
  pathTemplate: "../silo-{slug}",
  setup: "pnpm worktree {branch}",
  recipe: null,
};

function localSettings() {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  return createProjectSettings(db);
}

test("worktree settings come from the local settings only", () => {
  const settings = localSettings();
  expect(withLocalSettings({ ...meta, worktree }, settings).worktree).toBeNull();
  settings.set("p1", LOCAL_WORKTREE_KEY, JSON.stringify(worktree));
  expect(withLocalSettings(meta, settings).worktree).toEqual(worktree);
});

test("corrupt worktree settings are ignored with a warning, never thrown", () => {
  const settings = localSettings();
  const warn = spyOn(console, "error").mockImplementation(() => {});
  try {
    for (const raw of ["{not json", JSON.stringify({ ...worktree, pathTemplate: "" }), "null"]) {
      settings.set("p1", LOCAL_WORKTREE_KEY, raw);
      expect(withLocalSettings(meta, settings).worktree).toBeNull();
    }
    expect(warn).toHaveBeenCalledTimes(3);
  } finally {
    warn.mockRestore();
  }
});

const storybook = { origin: "https://sb.example.com", portEnv: "SB_PORT" };

test("storybook settings come from the local settings only", () => {
  const settings = localSettings();
  expect(localStorybook(settings, "p1")).toBeNull();
  expect(withLocalSettings({ ...meta, storybook }, settings).storybook).toBeNull();
  settings.set("p1", LOCAL_STORYBOOK_KEY, JSON.stringify(storybook));
  expect(localStorybook(settings, "p1")).toEqual(storybook);
  expect(withLocalSettings(meta, settings).storybook).toEqual(storybook);
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

test("duplication settings come from the local settings only, corrupt ones fall back to null", () => {
  const settings = localSettings();
  const duplication = {
    enabled: false,
    minLines: 10,
    compareTests: false,
    ignore: [],
    genericExports: ["main"],
  };
  expect(withLocalSettings({ ...meta, duplication }, settings).duplication).toBeNull();
  settings.set("p1", LOCAL_DUPLICATION_KEY, JSON.stringify(duplication));
  expect(withLocalSettings(meta, settings).duplication).toEqual(duplication);
  expect(localDuplication(settings, "p1")).toEqual(duplication);
  const warn = spyOn(console, "error").mockImplementation(() => {});
  try {
    settings.set("p1", LOCAL_DUPLICATION_KEY, JSON.stringify({ ...duplication, minLines: 99 }));
    expect(localDuplication(settings, "p1")).toBeNull();
  } finally {
    warn.mockRestore();
  }
});

test("localFolder reads the local setting, then the doc", () => {
  const settings = localSettings();
  const withDocFolder = { ...meta, folder: "/doc" };
  expect(localFolder(settings, withDocFolder)).toBe("/doc");
  settings.set("p1", LOCAL_FOLDER_KEY, "/local");
  expect(localFolder(settings, withDocFolder)).toBe("/local");
});
