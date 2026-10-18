import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { KiboError, type ProjectSnapshot } from "@kibo/schema";
import { z } from "zod";
import { connectLocalDaemon, readDaemonAccess } from "./src/daemon-client";
import { type DeadlinePlan, planToDeadline } from "./src/replan/deadline-plan";
import { renderReplanReport } from "./src/replan/replan-report";

const PROJECT_KEY = "EMIS";

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    apply: { type: "boolean", default: false },
    by: { type: "string" },
    export: { type: "string", default: join(homedir(), "Documents", "emis", "kibo-export-2026-10-18") },
    home: { type: "string", default: process.env.KIBO_HOME ?? join(homedir(), ".kibo") },
    yes: { type: "boolean", default: false },
  },
});

const print = (line: string) => console.log(line);
const exportDir = resolve(values.export);
const planFile = join(exportDir, "replan-plan.json");
const SavedPlan = z.object({ deadline: z.string(), commands: z.array(z.unknown()) });

function deadlineOf(): string {
  const by = values.by;
  if (by === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(by))
    throw new KiboError("INVALID_INPUT", "--by <YYYY-MM-DD> is required");
  return by;
}

function observedVelocity(): number | null {
  const file = join(exportDir, "rebase-plan.json");
  if (!existsSync(file)) return null;
  const parsed = z.object({ velocity: z.number() }).safeParse(JSON.parse(readFileSync(file, "utf8")));
  return parsed.success ? parsed.data.velocity : null;
}

const titlesOf = (snapshot: ProjectSnapshot): Map<string, string> =>
  new Map(snapshot.tickets.map((t) => [t.key ?? t.id, t.title]));

function summary(plan: DeadlinePlan): string[] {
  return [
    `${plan.remaining} étapes restantes · ${plan.sprints.length} sprints · capacité ${plan.capacity}`,
    `fin ${plan.sprints.at(-1)?.end ?? "—"} · ${plan.dropped.length} sprint(s) supprimé(s) · ${plan.commands.length} commande(s)`,
    `forcées : ${plan.forced.join(", ") || "aucune"}`,
  ];
}

async function withProject<T>(
  run: (rpc: Rpc, projectId: string, snapshot: ProjectSnapshot) => Promise<T>,
): Promise<T> {
  const client = await connectLocalDaemon(readDaemonAccess(values.home));
  try {
    const project = (await client.rpc({ method: "listProjects" })).find((p) => p.key === PROJECT_KEY);
    if (!project) throw new KiboError("NOT_FOUND", `no project ${PROJECT_KEY} in ${values.home}`);
    const snapshot = await client.rpc({ method: "getProject", projectId: project.id });
    return await run(client.rpc.bind(client), project.id, snapshot);
  } finally {
    await client.close();
  }
}
type Rpc = Awaited<ReturnType<typeof connectLocalDaemon>>["rpc"];

async function dryRun(): Promise<void> {
  const deadline = deadlineOf();
  await withProject(async (_rpc, _id, snapshot) => {
    const plan = planToDeadline(snapshot, deadline);
    writeFileSync(
      join(exportDir, "replan-report.md"),
      renderReplanReport(plan, titlesOf(snapshot), observedVelocity()),
    );
    writeFileSync(planFile, `${JSON.stringify({ deadline, commands: plan.commands }, null, 2)}\n`);
    for (const line of summary(plan)) print(line);
    print(`écrit ${join(exportDir, "replan-report.md")}`);
  });
}

async function apply(): Promise<void> {
  if (!values.yes) throw new KiboError("FORBIDDEN", "--apply rewrites the sprints: confirm with --yes");
  const saved = SavedPlan.parse(JSON.parse(readFileSync(planFile, "utf8")));
  await withProject(async (rpc, projectId, snapshot) => {
    const plan = planToDeadline(snapshot, saved.deadline);
    if (JSON.stringify(plan.commands) !== JSON.stringify(saved.commands))
      throw new KiboError("CONFLICT", "the project changed since the dry run: rerun --dry-run");
    const backup = await rpc({ method: "createBackup", reason: "manual" });
    print(`sauvegarde ${JSON.stringify(backup)}`);
    for (const command of plan.commands) await rpc({ method: "command", projectId, command });
    const after = await rpc({ method: "getProject", projectId });
    const left = planToDeadline(after, saved.deadline).commands;
    print(left.length === 0 ? "vérification : conforme" : `vérification : ${left.length} écart(s)`);
    if (left.length > 0) process.exitCode = 1;
  });
}

if (values["dry-run"] === values.apply) throw new KiboError("INVALID_INPUT", "choose --dry-run or --apply");
await (values.apply ? apply() : dryRun());
