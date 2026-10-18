import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BackupInfo, KiboError, ProjectCommand, type ProjectSnapshot } from "@kibo/schema";
import { z } from "zod";
import type { SeedClient } from "../daemon-client";
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

export async function seedPlan(
  client: SeedClient,
  plan: RebasePlan,
  progress: SeedProgress,
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

type ResultInput = {
  plan: RebasePlan;
  backup: BackupInfo;
  backupDir: string;
  oldId: string;
  newId: string | null;
  fresh: ProjectSnapshot | null;
  problems: readonly string[];
  failure: string | null;
};

function verdict(input: ResultInput): string[] {
  if (input.failure !== null) {
    const kept = input.newId
      ? `Le projet neuf ${input.newId} est conservé, incomplet : le supprimer, puis relancer \`--dry-run\`, ou restaurer à froid.`
      : "Aucun projet neuf n'a été créé : restaurer à froid.";
    const stage = input.failure.includes("key check") ? "à la vérification des clés" : "pendant le semis";
    return [`**Arrêt ${stage}** : ${input.failure}`, "", kept];
  }
  if (input.problems.length === 0) return ["**Conforme** : rien de perdu, rien d'inventé."];
  return [`**${input.problems.length} écart(s)** :`, "", ...input.problems.map((p) => `- ${p}`)];
}

function counts(fresh: ProjectSnapshot | null): string[] {
  if (fresh === null) return ["Aucun projet neuf à compter."];
  const features = fresh.tickets.filter((t) => t.parentId === null).length;
  return [
    `- pages : ${fresh.pages.length}`,
    `- sprints : ${fresh.sprints.length}`,
    `- fonctionnalités : ${features}`,
    `- étapes : ${fresh.tickets.length - features}`,
    `- liens : ${fresh.links.length}`,
    `- questions : ${fresh.questions.length}`,
    `- client : ${fresh.meta.client ?? "aucun"}`,
  ];
}

export function renderResult(input: ResultInput): string {
  const keys = [...input.plan.mapping.keys.entries()].map(([from, to]) => `| ${from} | ${to} |`);
  return [
    "# Rebase d'Emis · résultat",
    "",
    `- Sauvegarde : ${input.backup.id} (${input.backupDir}, ${input.backup.bytes} octets)`,
    `- Ancien projet : ${input.oldId} (supprimé)`,
    `- Nouveau projet : ${input.newId ?? "non créé"}`,
    `- Empreinte du plan : ${input.plan.fingerprint.slice(0, 12)}`,
    "",
    "## Vérification",
    "",
    ...verdict(input),
    "",
    "## Comptes",
    "",
    ...counts(input.fresh),
    "",
    "## Clés",
    "",
    "| Ancienne clé | Nouvelle clé |",
    "|---|---|",
    ...keys,
    "",
    "## Non transféré",
    "",
    "- L'historique de l'agent de projet et le journal `project_events` de l'ancien projet : ils restent dans la sauvegarde.",
    "",
    "## Restauration à froid",
    "",
    "1. Quitter Kibo (le démon s'arrête avec l'application).",
    `2. Recopier le contenu de \`${input.backupDir}\` (\`kibo.db\`, \`runs.db\`, \`components/\`, \`notes/\`) dans le dossier du démon (\`$KIBO_HOME\`, défaut \`~/.kibo\`).`,
    "3. Relancer Kibo.",
    "",
  ].join("\n");
}

export async function applyPlan(
  client: SeedClient,
  plan: RebasePlan,
  options: ApplyOptions,
): Promise<ApplyOutcome> {
  const print = options.print ?? (() => {});
  assertApplicable(plan);
  const { projectId: oldId, snapshot } = await readCurrent(client, plan);
  const old = readOldProject(snapshot);
  const backup = await client.rpc({ method: "createBackup", reason: "manual" });
  const { status } = await client.rpc({ method: "getBackups" });
  const context = { plan, backup, backupDir: join(status.dir, backup.id), oldId };
  writeFileSync(join(options.exportDir, "project-old.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  print(`backup ${backup.id} · export project-old.json`);
  const resultFile = join(options.exportDir, "rebase-result.md");
  await client.rpc({ method: "deleteProject", projectId: oldId });
  const progress: SeedProgress = { projectId: null };
  try {
    const { projectId, keys } = await seedPlan(client, plan, progress);
    const fresh = await client.rpc({ method: "getProject", projectId });
    const problems = verifyRebase(old, fresh, plan);
    writeFileSync(resultFile, renderResult({ ...context, newId: projectId, fresh, problems, failure: null }));
    print(`project ${projectId} · ${problems.length} problem(s) · ${resultFile}`);
    return { projectId, keys, problems, backup };
  } catch (e) {
    const failure = e instanceof Error ? e.message : String(e);
    writeFileSync(
      resultFile,
      renderResult({ ...context, newId: progress.projectId, fresh: null, problems: [], failure }),
    );
    throw e;
  }
}
