import type { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openRunStore } from "../agents/run-store";
import { WORKSPACE_DOC_ID } from "../projects/doc-ids";
import { loadDoc, openStore } from "../store";
import { FIXTURE_HOME_021, FIXTURE_PROJECT_ID } from "../testing/make-home-0.21";
import { createFileHistory } from "./file-history";
import { contentHash } from "./guarded-write";
import { createAgentSettingsStore } from "./settings-store";
import { copyFixtureHome, tempDir } from "./test-home.test-helper";

export function open() {
  const home = copyFixtureHome(FIXTURE_HOME_021);
  const claudeHome = join(tempDir("kibo-claude-"), "claude");
  const store = openStore(home);
  const runs = openRunStore(home);
  const workspace = loadDoc(store, WORKSPACE_DOC_ID);
  if (!workspace) throw new Error("fixture without workspace");
  const roots = { claudeHome, projectFolder: () => null };
  const settings = createAgentSettingsStore(store.db);
  const history = createFileHistory({ home, db: store.db });
  const input = {
    workspace,
    saveWorkspace: () => store.save(WORKSPACE_DOC_ID, workspace.export({ mode: "snapshot" })),
    runs,
    roots,
    settings,
    history,
    projectKeys: { [FIXTURE_PROJECT_ID]: "BOU" },
    now: () => Date.parse("2026-10-12T10:00:00Z"),
  };
  const close = () => {
    runs.close();
    store.close();
  };
  return {
    home,
    claudeHome,
    store,
    runs,
    workspace,
    settings,
    history,
    input,
    close,
    agents: join(claudeHome, "agents"),
  };
}

export const tables = (db: Database) =>
  JSON.stringify(
    ["file_versions", "agent_settings"].map((t) => db.query(`SELECT * FROM ${t} ORDER BY 1`).all()),
  );
export const files = (dir: string) =>
  readdirSync(dir)
    .sort()
    .map((f) => `${f}:${contentHash(readFileSync(join(dir, f), "utf8"))}`);
