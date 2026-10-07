import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { createProjectSettings, ensureSettingsTable } from "./notes/settings";
import { LOCAL_FOLDER_KEY, withLocalFolder } from "./project-folder";

const meta = { id: "p1", key: "KIB", name: "Kibo", folder: null, color: "#14B8A6", worktree: null };

test("a shared project gets its folder back from the local settings", () => {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  const settings = createProjectSettings(db);
  expect(withLocalFolder(meta, settings, false).folder).toBeNull();
  settings.set("p1", LOCAL_FOLDER_KEY, "/Users/adam/goinfre/Kibo");
  expect(withLocalFolder(meta, settings, true).folder).toBe("/Users/adam/goinfre/Kibo");
  expect(withLocalFolder({ ...meta, folder: "/ailleurs" }, settings, true).folder).toBe(
    "/Users/adam/goinfre/Kibo",
  );
});

test("a shared project never takes its folder from the doc", () => {
  const db = new Database(":memory:", { strict: true });
  ensureSettingsTable(db);
  const settings = createProjectSettings(db);
  expect(withLocalFolder({ ...meta, folder: "/tmp/evil" }, settings, true).folder).toBeNull();
  expect(withLocalFolder({ ...meta, folder: "/Users/adam/Perso" }, settings, false).folder).toBe(
    "/Users/adam/Perso",
  );
});
