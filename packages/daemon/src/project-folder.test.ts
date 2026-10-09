import { Database } from "bun:sqlite";
import { expect, spyOn, test } from "bun:test";
import { createProjectSettings, ensureSettingsTable } from "./notes/settings";
import { LOCAL_FOLDER_KEY, LOCAL_WORKTREE_KEY, withLocalSettings } from "./project-folder";

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
