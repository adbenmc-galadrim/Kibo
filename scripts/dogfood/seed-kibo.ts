import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { connectLocalDaemon, readDaemonAccess } from "./src/daemon-client";
import { loadDesired } from "./src/load";
import { SEED_KINDS, type SeedReport, seedKibo } from "./src/seed";

const REPO = resolve(import.meta.dir, "..", "..");
const { values } = parseArgs({
  options: {
    home: { type: "string", default: process.env.KIBO_HOME ?? join(homedir(), ".kibo") },
    folder: { type: "string", default: REPO },
  },
});

function print(report: SeedReport): void {
  console.log(`project ${report.projectId}`);
  for (const kind of SEED_KINDS)
    console.log(`${kind.padEnd(13)} created ${report.created[kind]}  kept ${report.kept[kind]}`);
  for (const w of report.warnings) console.log(`warning: ${w}`);
}

const client = await connectLocalDaemon(readDaemonAccess(values.home));
try {
  print(await seedKibo(client, loadDesired(REPO, resolve(values.folder))));
} finally {
  await client.close();
}
