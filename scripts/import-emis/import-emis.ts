import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { KiboError } from "@kibo/schema";
import { applyDesired } from "./src/apply";
import { archive } from "./src/archive";
import { preflight } from "./src/backup";
import { connectLocalDaemon, readDaemonAccess } from "./src/daemon-client";
import { desiredState } from "./src/desired";
import { loadEmisFiles } from "./src/emis-files";
import { readPrs } from "./src/gh";
import { builtinVersions } from "./src/kibo-components";
import { checkPlan } from "./src/plan-check";
import { flatPrs, loadAnswers, loadPlan } from "./src/plan-source";
import { printReport } from "./src/report";

const { values } = parseArgs({
  options: {
    emis: { type: "string", default: join(homedir(), "Documents", "emis") },
    home: { type: "string", default: process.env.KIBO_HOME ?? join(homedir(), ".kibo") },
    notes: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "no-gh": { type: "boolean", default: false },
    yes: { type: "boolean", default: false },
    archive: { type: "boolean", default: false },
  },
});

const print = (line: string) => console.log(line);
const today = new Date().toISOString().slice(0, 10);
const emisDir = resolve(values.emis);
const dryRun = values["dry-run"];

async function main(): Promise<void> {
  const plan = loadPlan(join(emisDir, "tmp", "plan-data.js"));
  const errors = checkPlan(plan);
  if (errors.length > 0) {
    for (const e of errors) console.error(`✗ ${e}`);
    throw new KiboError("INVALID_INPUT", `the plan has ${errors.length} errors, nothing was written`);
  }
  const numbers = flatPrs(plan).flatMap((p) => (p.pr ? [p.pr] : []));
  const prs = values["no-gh"]
    ? new Map()
    : await readPrs(plan.meta.repo, numbers, (w) => print(`warning: ${w}`));
  const folder = join(emisDir, "emis");
  const notesDir = resolve(values.notes ?? join(emisDir, "kibo-notes"));
  const desired = desiredState({
    plan,
    answers: loadAnswers(join(emisDir, "tmp", "reponses.json")),
    files: loadEmisFiles(emisDir, folder),
    repoUrl: plan.meta.repo,
    prs,
    notesDir,
  });
  const client = await connectLocalDaemon(readDaemonAccess(values.home));
  try {
    if (!dryRun) await preflight(client, { home: values.home, yes: values.yes, date: today, print });
    const result = await applyDesired(client, desired, {
      folder,
      notesDir,
      dryRun,
      manifestVersions: builtinVersions(desired.pages),
      print,
    });
    printReport(result.counts, print);
  } finally {
    await client.close();
  }
  if (values.archive && !dryRun) for (const path of archive(emisDir, today)) print(`archived ${path}`);
}

try {
  await main();
} catch (e) {
  console.error(e instanceof KiboError ? `${e.code}: ${e.message}` : String(e));
  process.exit(1);
}
