import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { KiboError, sprintPlan } from "@kibo/schema";
import { connectLocalDaemon, readDaemonAccess } from "./src/daemon-client";
import { readMerges } from "./src/gh";
import { mapProject } from "./src/rebase/mapping";
import { type OldProject, readOldProject, readTicketsList } from "./src/rebase/old-project";
import { buildRebasePlan, type PlanSource, type RebasePlan, serializePlan } from "./src/rebase/plan-file";
import { QUESTION_PLACEMENT } from "./src/rebase/question-placement";
import { pointsToPlace, renderReport } from "./src/rebase/report";
import { TODO_PLACEMENT } from "./src/rebase/todo-placement";
import { type Merge, repoOf } from "./src/rebase/velocity";

const PROJECT_KEY = "EMIS";
const LIST_META = { name: "Emis", key: PROJECT_KEY, folder: null, color: "#71717A", client: null };

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
    plan: { type: "string" },
    export: { type: "string", default: join(homedir(), "Documents", "emis", "kibo-export-2026-10-18") },
    home: { type: "string", default: process.env.KIBO_HOME ?? join(homedir(), ".kibo") },
    "no-gh": { type: "boolean", default: false },
    "from-list": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
  },
});

const print = (line: string) => console.log(line);
const exportDir = resolve(values.export);

async function fromDaemon(home: string): Promise<OldProject> {
  const client = await connectLocalDaemon(readDaemonAccess(home));
  try {
    const project = (await client.rpc({ method: "listProjects" })).find((p) => p.key === PROJECT_KEY);
    if (!project) throw new KiboError("NOT_FOUND", `no project ${PROJECT_KEY} in ${home}`);
    const snapshot = await client.rpc({ method: "getProject", projectId: project.id });
    writeFileSync(join(exportDir, "project-old.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
    return readOldProject(snapshot);
  } finally {
    await client.close();
  }
}

function fromList(): OldProject {
  const list: unknown = JSON.parse(readFileSync(join(exportDir, "tickets-list.json"), "utf8"));
  return readTicketsList(list, LIST_META);
}

async function merges(old: OldProject): Promise<Merge[] | null> {
  if (values["no-gh"]) return null;
  const repo = repoOf(mapProject(old, TODO_PLACEMENT, QUESTION_PLACEMENT));
  if (repo === null) return null;
  try {
    return await readMerges(repo);
  } catch (e) {
    print(`warning: gh pr list unreadable, default velocity: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function summary(plan: RebasePlan, planFile: string): string[] {
  const last = sprintPlan(plan.setup).at(-1);
  const steps = plan.mapping.features.flatMap((f) => f.steps).length;
  const toPlace = pointsToPlace(plan);
  return [
    `source ${plan.source} · empreinte ${plan.fingerprint.slice(0, 12)}`,
    `${plan.mapping.features.length} fonctionnalités · ${steps} étapes · ${plan.mapping.questions.length} questions`,
    `vitesse ${plan.velocity} (${plan.velocitySource})`,
    `${plan.setup.sprintCount} sprints · fin prévue ${last?.end ?? "—"}`,
    `${toPlace.length} point(s) à placer`,
    `écrit ${join(exportDir, "rebase-report.md")}`,
    `écrit ${planFile}`,
  ];
}

async function dryRun(): Promise<void> {
  const source: PlanSource = values["from-list"] ? "tickets-list" : "getProject";
  const old = values["from-list"] ? fromList() : await fromDaemon(values.home);
  const plan = buildRebasePlan({
    old,
    source,
    merges: await merges(old),
    placement: TODO_PLACEMENT,
    overrides: QUESTION_PLACEMENT,
  });
  const report = renderReport(plan);
  const planFile = join(exportDir, "rebase-plan.json");
  writeFileSync(join(exportDir, "rebase-report.md"), report);
  writeFileSync(planFile, serializePlan(plan));
  for (const line of summary(plan, planFile)) print(line);
}

async function main(): Promise<void> {
  if (values.apply) {
    console.error("--apply is delivered by T19 of phase 27; nothing was written");
    process.exit(2);
  }
  if (!values["dry-run"])
    throw new KiboError("INVALID_INPUT", "choose --dry-run (or --apply --plan <file> --yes)");
  await dryRun();
}

try {
  await main();
} catch (e) {
  console.error(e instanceof KiboError ? `${e.code}: ${e.detail}` : String(e));
  process.exit(1);
}
