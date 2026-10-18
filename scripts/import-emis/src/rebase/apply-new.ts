import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type BackupInfo,
  compareAppVersions,
  KiboError,
  ProjectCommand,
  type ProjectMeta,
  type ProjectPatch,
  type ProjectSnapshot,
} from "@kibo/schema";
import { z } from "zod";
import type { SeedClient } from "../daemon-client";
import { renderResult } from "./apply-result";
import type { PlannedCommand } from "./desired-new";
import { readOldProject } from "./old-project";
import type { RebasePlan } from "./plan-file";
import { pointsToPlace } from "./report";
import { verifyRebase } from "./verify";

export type SeedProgress = { projectId: string | null };
export type ApplyOptions = { exportDir: string; print?: (line: string) => void };
export type ApplyOutcome = {
  projectId: string;
  keys: Map<string, string>;
  problems: string[];
  backup: BackupInfo;
};

const Created = z.object({ id: z.string().min(1), key: z.string().nullable().optional() });
const ID_FIELDS: readonly string[] = ["ticketId", "parentId", "from", "to", "questionId", "sprintId"];
const PLACEHOLDER = /^(new|sprint):/;

function resolved(command: ProjectCommand, ids: ReadonlyMap<string, string>): ProjectCommand {
  const entries = Object.entries(command).map(([field, value]) => {
    if (!ID_FIELDS.includes(field) || typeof value !== "string" || !PLACEHOLDER.test(value))
      return [field, value];
    const id = ids.get(value);
    if (id === undefined) throw new KiboError("INVALID_INPUT", `unresolved placeholder ${value}`);
    return [field, id];
  });
  return ProjectCommand.parse(Object.fromEntries(entries));
}

function checkedKey(planned: Extract<PlannedCommand, { op: "command" }>, result: unknown): void {
  if (planned.expectKey === null) return;
  const got = Created.parse(result).key ?? null;
  if (got !== planned.expectKey)
    throw new KiboError(
      "CONFLICT",
      `key check failed for ${planned.defines ?? "a ticket"}: predicted ${planned.expectKey}, daemon gave ${got ?? "none"}`,
    );
}

const SETTING_KEYS = ["worktree", "storybook", "duplication", "delivery", "tracking", "description"] as const;

export function settingsPatch(meta: ProjectMeta): ProjectPatch | null {
  const entries = SETTING_KEYS.flatMap((key) => (meta[key] === null ? [] : [[key, meta[key]] as const]));
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export async function seedPlan(
  client: SeedClient,
  plan: RebasePlan,
  progress: SeedProgress,
  settings: ProjectPatch | null = null,
): Promise<{ projectId: string; keys: Map<string, string> }> {
  const [head, ...rest] = plan.commands;
  if (head?.op !== "createProject")
    throw new KiboError("INVALID_INPUT", "a rebase plan starts with createProject");
  const { name, key, folder, color, client: projectClient, setup } = head;
  const meta = await client.rpc({
    method: "createProject",
    name,
    key,
    folder,
    color,
    client: projectClient,
    setup,
  });
  const projectId = meta.id;
  progress.projectId = projectId;
  if (settings !== null) await client.rpc({ method: "updateProject", projectId, patch: settings });
  const created = await client.rpc({ method: "getProject", projectId });
  const ids = new Map(created.sprints.map((s) => [`sprint:${s.code}`, s.id]));
  for (const planned of rest) {
    if (planned.op === "createProject")
      throw new KiboError("INVALID_INPUT", "a rebase plan creates one project");
    if (planned.op === "setDeliveryStep") {
      const { ticketKey, step, note, kind } = planned;
      await client.rpc({ method: "setDeliveryStep", projectId, ticketKey, step, note, kind });
      continue;
    }
    const command = resolved(planned.command, ids);
    const result = await client.rpc({ method: "command", projectId, command });
    checkedKey(planned, result);
    if (planned.defines !== null) ids.set(planned.defines, Created.parse(result).id);
  }
  return { projectId, keys: new Map(plan.mapping.keys) };
}

export function assertApplicable(plan: RebasePlan): void {
  if (plan.source !== "getProject")
    throw new KiboError("INVALID_INPUT", `plan read from ${plan.source}: rerun --dry-run against the daemon`);
  const toPlace = pointsToPlace(plan);
  if (toPlace.length > 0)
    throw new KiboError(
      "INVALID_INPUT",
      `plan has ${toPlace.length} point(s) to place: ${toPlace.join(" ")}`,
    );
}

export const MIN_DAEMON_VERSION = "0.27.0-alpha.1";
const TAURI_CONF = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "apps",
  "desktop",
  "src-tauri",
  "tauri.conf.json",
);
const BuildVersion = z.object({ version: z.string() });

export function requiredDaemonVersion(
  build = BuildVersion.parse(JSON.parse(readFileSync(TAURI_CONF, "utf8"))),
): string {
  return compareAppVersions(build.version, MIN_DAEMON_VERSION) > 0 ? build.version : MIN_DAEMON_VERSION;
}

export async function assertDaemonRecent(
  client: SeedClient,
  required = requiredDaemonVersion(),
): Promise<void> {
  const { version } = await client.rpc({ method: "getAppInfo" });
  if (compareAppVersions(version, required) < 0)
    throw new KiboError(
      "CONFLICT",
      `démon trop ancien (${version}) : redémarre Kibo sur la version ${required} ou plus récente avant --apply`,
    );
}

export async function readCurrent(
  client: SeedClient,
  plan: RebasePlan,
): Promise<{ projectId: string; snapshot: ProjectSnapshot }> {
  const key = plan.mapping.project.key;
  const project = (await client.rpc({ method: "listProjects" })).find((p) => p.key === key);
  if (!project) throw new KiboError("NOT_FOUND", `no project ${key} to rebase`);
  const snapshot = await client.rpc({ method: "getProject", projectId: project.id });
  const fingerprint = readOldProject(snapshot).fingerprint;
  if (fingerprint !== plan.fingerprint)
    throw new KiboError(
      "CONFLICT",
      `fingerprint mismatch: plan ${plan.fingerprint.slice(0, 12)}, project ${key} ${fingerprint.slice(0, 12)}; rerun --dry-run`,
    );
  return { projectId: project.id, snapshot };
}

type NotesCopy = { copied: string[]; notCopied: string[] };

async function copyNotesDir(client: SeedClient, projectId: string, dir: string): Promise<NotesCopy> {
  if ((await client.rpc({ method: "getNotesDir", projectId })).dir === dir)
    return { copied: [], notCopied: [] };
  try {
    await client.rpc({ method: "setNotesDir", projectId, dir });
    return { copied: ["dossier de notes"], notCopied: [] };
  } catch (e) {
    return {
      copied: [],
      notCopied: [`Dossier de notes ${dir} : ${e instanceof Error ? e.message : String(e)}.`],
    };
  }
}

export async function applyPlan(
  client: SeedClient,
  plan: RebasePlan,
  options: ApplyOptions,
): Promise<ApplyOutcome> {
  const print = options.print ?? (() => {});
  assertApplicable(plan);
  await assertDaemonRecent(client);
  const { projectId: oldId, snapshot } = await readCurrent(client, plan);
  const old = readOldProject(snapshot);
  const notes = await client.rpc({ method: "getNotesDir", projectId: oldId });
  const settings = settingsPatch(snapshot.meta);
  const backup = await client.rpc({ method: "createBackup", reason: "manual" });
  const { status } = await client.rpc({ method: "getBackups" });
  const context = { plan, backup, backupDir: join(status.dir, backup.id), oldId, old: snapshot };
  writeFileSync(join(options.exportDir, "project-old.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  print(`backup ${backup.id} · export project-old.json`);
  const resultFile = join(options.exportDir, "rebase-result.md");
  await client.rpc({ method: "deleteProject", projectId: oldId });
  const progress: SeedProgress = { projectId: null };
  const copied = Object.keys(settings ?? {});
  try {
    const { projectId, keys } = await seedPlan(client, plan, progress, settings);
    const notesCopy = await copyNotesDir(client, projectId, notes.dir);
    const fresh = await client.rpc({ method: "getProject", projectId });
    const problems = verifyRebase(old, fresh, plan);
    const result = { ...context, newId: projectId, fresh, problems, failure: null };
    const notCopied = notesCopy.notCopied;
    writeFileSync(
      resultFile,
      renderResult({ ...result, copied: [...copied, ...notesCopy.copied], notCopied }),
    );
    for (const line of notCopied) print(line);
    print(`project ${projectId} · ${problems.length} problem(s) · ${resultFile}`);
    return { projectId, keys, problems, backup };
  } catch (e) {
    const failure = e instanceof Error ? e.message : String(e);
    const result = { ...context, newId: progress.projectId, fresh: null, problems: [], failure };
    writeFileSync(resultFile, renderResult({ ...result, copied: [], notCopied: [] }));
    throw e;
  }
}
