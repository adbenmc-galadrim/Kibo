import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listGuidelines } from "@kibo/core/agent-config";
import { parseAgentFile } from "@kibo/core/agents/frontmatter";
import { profilesMap } from "@kibo/core/config-store";
import { openRunStore } from "../agents/run-store";
import { WORKSPACE_DOC_ID } from "../projects/doc-ids";
import { loadDoc, openStore } from "../store";
import { FIXTURE_HOME_021, FIXTURE_PROJECT_ID } from "../testing/make-home-0.21";
import { createAgentCatalog } from "./catalog";
import { createFileHistory } from "./file-history";
import { contentHash } from "./guarded-write";
import { MIGRATION_MARKER, migrateProfiles } from "./migration";
import { createNoticeBox } from "./notices";
import { createAgentFilesService } from "./service";
import { createAgentSettingsStore } from "./settings-store";
import { AGENT_TEMPLATE_FILES } from "./templates";
import { agentText, copyFixtureHome, tempDir } from "./test-home.test-helper";

function open() {
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

const tables = (db: Database) =>
  JSON.stringify(
    ["file_versions", "agent_settings"].map((t) => db.query(`SELECT * FROM ${t} ORDER BY 1`).all()),
  );
const files = (dir: string) =>
  readdirSync(dir)
    .sort()
    .map((f) => `${f}:${contentHash(readFileSync(join(dir, f), "utf8"))}`);

test("profiles become agent files with their settings, and the runs point to agent references", async () => {
  const m = open();
  const result = await migrateProfiles(m.input);
  expect(result).toEqual({ migrated: true, notices: [] });
  expect(readdirSync(m.agents).sort()).toEqual([
    "haiku-tests.md",
    "kibo-assistant.md",
    "kibo-demo.md",
    "kibo-generateur.md",
    "kibo-project-agent.md",
    "opus.md",
    "sonnet-review.md",
  ]);
  const review = parseAgentFile(readFileSync(join(m.agents, "sonnet-review.md"), "utf8"));
  expect(review).toEqual({
    file: {
      frontmatter: {
        name: "sonnet-review",
        description: "Agent migré du profil Kibo sonnet-review",
        model: "sonnet",
        extra: "",
        extraKeys: [],
      },
      body: "## review/regles.md\n\nChaque remarque cite un fichier.\n\n## review/ton.md\n\nReste bref et poli.",
    },
  });
  expect(m.settings.get("global:sonnet-review")).toMatchObject({
    permissionMode: "plan",
    maxParallel: 3,
    subagents: [],
    genericSubagents: true,
  });
  expect(m.settings.get("global:opus")).toMatchObject({ allow: ["Bash(git *)"], maxParallel: 1 });
  expect(m.settings.get("system:generateur").maxParallel).toBe(3);
  expect(readFileSync(join(m.agents, "kibo-project-agent.md"), "utf8")).toContain(
    "Parle comme un chef de projet.",
  );
  expect(m.runs.records().map((r) => [r.profileId, r.profileName, r.agentScope, r.projectKey])).toEqual([
    ["global:sonnet-review", "sonnet-review", "global", "BOU"],
    ["global:haiku-tests", "haiku-tests", "global", "BOU"],
    ["global:opus", "opus", "global", "BOU"],
    ["system:project-agent", "kibo-project-agent", "system", "BOU"],
  ]);
  expect(m.history.list("agents", "global:opus").map((v) => v.origin)).toEqual(["migration"]);
  m.close();
});

test("the workspace loses its profiles, the runs stay append-only and the marker is set", async () => {
  const m = open();
  await migrateProfiles(m.input);
  expect(Object.keys(profilesMap(m.workspace).toJSON())).toEqual([]);
  expect(listGuidelines(m.workspace).map((g) => g.path)).toEqual(["commun.md"]);
  const saved = loadDoc(m.store, WORKSPACE_DOC_ID);
  expect(Object.keys(saved ? profilesMap(saved).toJSON() : { x: 1 })).toEqual([]);
  expect(m.runs.marker(MIGRATION_MARKER)).toBe("2026-10-12T10:00:00.000Z");
  m.close();
  const db = new Database(join(m.home, "runs.db"));
  expect(() => db.exec("UPDATE runs SET brief = ''")).toThrow("append-only");
  db.close();
});

test("a second migration changes nothing", async () => {
  const m = open();
  await migrateProfiles(m.input);
  const before = {
    files: files(m.agents),
    tables: tables(m.store.db),
    runs: JSON.stringify(m.runs.records()),
  };
  expect(await migrateProfiles(m.input)).toEqual({ migrated: false, notices: [] });
  expect({
    files: files(m.agents),
    tables: tables(m.store.db),
    runs: JSON.stringify(m.runs.records()),
  }).toEqual(before);
  m.close();
});

test("an existing file of the same name is never overwritten, its guidelines go to the history with a notice", async () => {
  const m = open();
  const own = agentText("opus", "Mon agent opus écrit à la main", "À moi");
  mkdirSync(m.agents, { recursive: true });
  writeFileSync(join(m.agents, "opus.md"), own);
  const result = await migrateProfiles(m.input);
  expect(readFileSync(join(m.agents, "opus.md"), "utf8")).toBe(own);
  expect(result.notices).toEqual([
    {
      profileName: "opus",
      text: "Profil opus : un agent du même nom existait déjà, ses guidelines sont dans l'historique",
    },
  ]);
  const [version] = m.history.list("agents", "global:opus");
  expect(version?.origin).toBe("migration");
  expect(m.history.read(version?.id ?? "")?.content).toContain("Écris un plan avant de coder.");
  expect(m.settings.get("global:opus").allow).toEqual(["Bash(git *)"]);
  m.close();
});

test("the first agents.list gives the migration notices once", async () => {
  const m = open();
  mkdirSync(m.agents, { recursive: true });
  writeFileSync(join(m.agents, "opus.md"), agentText("opus", "Mon agent opus écrit à la main"));
  const { notices } = await migrateProfiles(m.input);
  const catalog = createAgentCatalog({
    roots: m.input.roots,
    projects: () => [],
    settings: m.settings,
    history: m.history,
    activeRuns: () => 0,
    watch: () => ({ mode: () => "watch", close: () => undefined }),
  });
  const service = createAgentFilesService({
    catalog,
    roots: m.input.roots,
    settings: m.settings,
    history: m.history,
    templates: AGENT_TEMPLATE_FILES,
    notices: createNoticeBox(notices),
    emit: () => undefined,
  });
  await catalog.refresh();
  expect(service.list(null).notices.map((n) => n.profileName)).toEqual(["opus"]);
  expect(service.list(null).notices).toEqual([]);
  expect(service.read("global:opus").settings.allow).toEqual(["Bash(git *)"]);
  m.close();
});
