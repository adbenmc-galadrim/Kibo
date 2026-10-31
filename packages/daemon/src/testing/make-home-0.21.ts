import { Database } from "bun:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createWorkspaceDoc } from "@kibo/core/workspace";
import { WORKSPACE_DOC_ID } from "../projects/doc-ids";
import { openStore } from "../store";

export const FIXTURE_HOME_021 = join(import.meta.dir, "fixtures", "kibo-home-0.21");
const FIXTURE_PROJECT_ID = "5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const FIXTURE_PROFILE_IDS = {
  "sonnet-review": "7a0e9c1d-2b3f-4c5d-8e6f-0a1b2c3d4e5f",
  "haiku-tests": "8b1f0d2e-3c4a-4d6e-9f7a-1b2c3d4e5f60",
  opus: "9c2a1e3f-4d5b-4e7f-a08b-2c3d4e5f6071",
} as const;

const RUNS_021 = [
  "CREATE TABLE runs (id TEXT PRIMARY KEY, seq INTEGER NOT NULL UNIQUE, project_id TEXT, ticket_id TEXT, " +
    "ticket_key TEXT, ticket_title TEXT NOT NULL, profile_id TEXT NOT NULL, profile_name TEXT NOT NULL, " +
    "session_id TEXT NOT NULL, brief TEXT NOT NULL, created_at INTEGER NOT NULL, resumed_from TEXT, " +
    "kind TEXT NOT NULL DEFAULT 'ticket')",
  "CREATE TABLE run_events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), " +
    "at INTEGER NOT NULL, data TEXT NOT NULL)",
  "CREATE INDEX run_events_by_run ON run_events (run_id, id)",
  "CREATE TABLE run_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL REFERENCES runs(id), " +
    "hash TEXT NOT NULL, at INTEGER NOT NULL)",
  "CREATE TABLE host_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  ...["runs", "run_events", "run_tokens"].flatMap((t) => [
    `CREATE TRIGGER ${t}_no_update BEFORE UPDATE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
    `CREATE TRIGGER ${t}_no_delete BEFORE DELETE ON ${t} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
  ]),
];

const userProfile = (
  name: keyof typeof FIXTURE_PROFILE_IDS,
  fields: { model: string; permissionMode: string; workspace: string; maxParallel: number; allow?: string[] },
) => ({
  id: FIXTURE_PROFILE_IDS[name],
  name,
  execution: "cli",
  subagents: ["haiku"],
  enabled: true,
  allow: [],
  system: false,
  ...fields,
});

const systemProfile = (id: string, permissionMode: string, maxParallel: number) => ({
  id,
  name: id,
  model: "sonnet",
  execution: "cli",
  permissionMode,
  workspace: "isolated",
  maxParallel,
  subagents: [],
  enabled: true,
  allow: [],
  system: true,
});

const profileGuideline = (id: string, profileId: string, path: string, content: string) => ({
  id,
  owner: { scope: "profile", profileId },
  path,
  content,
});

function writeWorkspace(home: string): void {
  const doc = createWorkspaceDoc();
  const profiles = doc.getMap("profiles");
  for (const p of [
    userProfile("sonnet-review", {
      model: "sonnet",
      permissionMode: "plan",
      workspace: "worktree",
      maxParallel: 3,
    }),
    userProfile("haiku-tests", {
      model: "haiku",
      permissionMode: "acceptEdits",
      workspace: "worktree",
      maxParallel: 2,
    }),
    userProfile("opus", {
      model: "opus",
      permissionMode: "default",
      workspace: "worktree",
      maxParallel: 1,
      allow: ["Bash(git *)"],
    }),
    systemProfile("assistant", "default", 1),
    systemProfile("generateur", "acceptEdits", 3),
    systemProfile("demo", "acceptEdits", 1),
    systemProfile("project-agent", "default", 1),
  ])
    profiles.set(p.id, p);
  const guidelines = doc.getMap("guidelines");
  const review = FIXTURE_PROFILE_IDS["sonnet-review"];
  for (const g of [
    profileGuideline("g-ton", review, "review/ton.md", "Reste bref et poli."),
    profileGuideline("g-regles", review, "review/regles.md", "Chaque remarque cite un fichier."),
    profileGuideline("g-opus", FIXTURE_PROFILE_IDS.opus, "opus/plan.md", "Écris un plan avant de coder."),
    profileGuideline("g-chef", "project-agent", "chef/ton.md", "Parle comme un chef de projet."),
    { id: "g-ws", owner: { scope: "workspace" }, path: "commun.md", content: "Réponds en français." },
  ])
    guidelines.set(g.id, g);
  doc.commit();
  const store = openStore(home);
  store.save(WORKSPACE_DOC_ID, doc.export({ mode: "snapshot" }));
  store.db.exec("PRAGMA journal_mode = DELETE");
  store.close();
  for (const leftover of ["kibo.db-wal", "kibo.db-shm"]) rmSync(join(home, leftover), { force: true });
}

function writeRuns(home: string): void {
  const db = new Database(join(home, "runs.db"), { create: true, strict: true });
  for (const sql of RUNS_021) db.exec(sql);
  const insert = db.query(
    "INSERT INTO runs VALUES ($id, $seq, $project, $ticket, $key, $title, $profile, $name, $sid, '', $at, NULL, $kind)",
  );
  const runs = [
    {
      id: "r1",
      ticket: "t1",
      key: "BOU-12",
      profile: FIXTURE_PROFILE_IDS["sonnet-review"],
      name: "sonnet-review",
      kind: "ticket",
    },
    {
      id: "r2",
      ticket: "t2",
      key: "BOU-13",
      profile: FIXTURE_PROFILE_IDS["haiku-tests"],
      name: "haiku-tests",
      kind: "ticket",
    },
    {
      id: "r3",
      ticket: "t3",
      key: "BOU-14",
      profile: FIXTURE_PROFILE_IDS.opus,
      name: "opus",
      kind: "ticket",
    },
    { id: "r4", ticket: null, key: null, profile: "project-agent", name: "project-agent", kind: "project" },
  ];
  runs.forEach((r, i) => {
    insert.run({
      ...r,
      seq: i + 1,
      project: FIXTURE_PROJECT_ID,
      title: `Run ${r.id}`,
      sid: `s-${r.id}`,
      at: 1_000 + i,
    });
  });
  db.query(
    'INSERT INTO run_events (run_id, at, data) VALUES (\'r1\', 1000, \'{"type":"enqueued","rank":0}\')',
  ).run();
  db.close();
}

function makeHome021(home: string): void {
  rmSync(home, { recursive: true, force: true });
  mkdirSync(home, { recursive: true, mode: 0o700 });
  writeWorkspace(home);
  writeRuns(home);
}

if (import.meta.main) makeHome021(FIXTURE_HOME_021);
