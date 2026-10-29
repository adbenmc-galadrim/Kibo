import { basename } from "node:path";
import { KiboError, type PlanOutcome, type PlanPreview } from "@kibo/schema";
import type { Parsed } from "../args";
import type { DaemonClient } from "../daemon-client";
import { explainError } from "../error-text";
import { fr } from "../fr";
import { frPlan } from "../fr-plan";
import { formatOf, type PlanFile, parsePlanText } from "../plan/plan-file";
import { outcomeLines, previewLines, problemLines } from "../plan/plan-text";
import { readTextArg } from "../text-source";
import { type Connect, printJson, type SessionIo, withClient } from "./daemon-session";
import { chooseProject } from "./tickets-context";

type PlanRun = { file: string; plan: PlanFile; json: boolean; io: SessionIo };

function readPlan(file: string, cwd: string, io: SessionIo): PlanFile | null {
  try {
    return parsePlanText(readTextArg(`@${file}`, cwd), formatOf(file));
  } catch (e) {
    if (!(e instanceof KiboError)) throw e;
    for (const line of (explainError(e) ?? fr.error(e.code, e.detail)).split("\n")) io.err(line);
    return null;
  }
}

function refuse(io: SessionIo, problems: PlanOutcome["problems"]): number {
  io.err(frPlan.apply.refused(problems.length));
  for (const line of problemLines(problems)) io.err(line);
  return 1;
}

function showPreview(run: PlanRun, preview: PlanPreview): number {
  if (run.json) {
    printJson(run.io, preview);
    return preview.ok ? 0 : 1;
  }
  if (!preview.ok) return refuse(run.io, preview.problems);
  run.io.out(frPlan.apply.title(run.plan.summary ?? basename(run.file)));
  for (const line of previewLines(run.plan.actions, preview.keys)) run.io.out(line);
  run.io.out(frPlan.apply.dryRun(run.plan.actions.length));
  return 0;
}

function showOutcome(run: PlanRun, outcome: PlanOutcome): number {
  const failed = outcome.problems.length > 0 || outcome.stoppedAt !== null;
  if (run.json) printJson(run.io, outcome);
  else if (outcome.problems.length > 0) return refuse(run.io, outcome.problems);
  else for (const line of outcomeLines(run.plan.actions, outcome)) run.io.out(line);
  return failed ? 1 : 0;
}

async function send(client: DaemonClient, projectId: string, run: PlanRun, dryRun: boolean): Promise<number> {
  const actions = run.plan.actions;
  if (dryRun) return showPreview(run, await client.rpc({ method: "previewPlan", projectId, actions }));
  return showOutcome(run, await client.rpc({ method: "applyPlan", projectId, actions }));
}

export async function planApply(
  file: string,
  flags: Parsed["flags"],
  io: SessionIo,
  connect?: Connect,
  cwd: string = process.cwd(),
): Promise<number> {
  const wanted = flags.project;
  if (wanted !== undefined && typeof wanted !== "string") {
    io.err(frPlan.usage);
    return 2;
  }
  const plan = readPlan(file, cwd, io);
  if (plan === null) return 1;
  const run: PlanRun = { file, plan, json: flags.json === true, io };
  return withClient(
    io,
    async (client) => {
      const choice = chooseProject(await client.rpc({ method: "listProjects" }), "", wanted, cwd);
      if ("problem" in choice) {
        io.err(choice.problem);
        return choice.code;
      }
      return send(client, choice.project.id, run, flags["dry-run"] === true);
    },
    connect,
  );
}
