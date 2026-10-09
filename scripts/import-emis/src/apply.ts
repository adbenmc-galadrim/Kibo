import type { ProjectCommand } from "@kibo/schema";
import { z } from "zod";
import {
  ensureNotesDir,
  ensurePages,
  ensureProfileAndGuidelines,
  ensureProject,
  type Step,
} from "./apply-config";
import type { SeedClient } from "./daemon-client";
import type { Desired } from "./desired";
import { refKey } from "./desired-tickets";
import { loadMemory, saveMemory } from "./import-memory";
import { writeNotes } from "./notes";
import { type Change, type ReconcileSnapshot, reconcile, resolveCommand } from "./reconcile";
import { buildReport, type ImportReport } from "./report";

export type ApplyOptions = {
  folder: string;
  notesDir: string;
  dryRun: boolean;
  manifestVersions: ReadonlyMap<string, string>;
  print?: (line: string) => void;
};
export type ApplyResult = { projectId: string | null; counts: ImportReport; changes: Change[] };

const EMPTY: ReconcileSnapshot = { tickets: [], links: [], questions: [] };
const Created = z.object({ id: z.string().min(1) });

function describe(command: ProjectCommand, snapshot: ReconcileSnapshot): string {
  if (command.method !== "deleteTicket") return `would send ${JSON.stringify(command)}`;
  const ticket = snapshot.tickets.find((t) => t.id === command.ticketId);
  return `would delete ticket ${ticket?.key ?? command.ticketId} · ${ticket?.title ?? ""}`;
}

function ticketKeys(snapshot: ReconcileSnapshot): Map<string, string> {
  const keys = new Map<string, string>();
  for (const t of snapshot.tickets)
    for (const r of t.externalRefs) if (r.kind === "import_ref" && t.key) keys.set(refKey(r), t.key);
  return keys;
}

async function ensureTickets(
  step: Step,
  projectId: string | null,
  notesDir: string,
): Promise<ReconcileSnapshot> {
  const snapshot = projectId ? await step.client.rpc({ method: "getProject", projectId }) : EMPTY;
  const plan = reconcile(snapshot, step.desired, loadMemory(notesDir));
  step.changes.push(...plan.changes);
  if (step.dryRun || projectId === null) {
    for (const c of plan.commands) step.print(describe(c, snapshot));
    return snapshot;
  }
  const send = (command: ProjectCommand) => step.client.rpc({ method: "command", projectId, command });
  const ids = new Map<string, string>();
  for (const [index, command] of plan.commands.entries()) {
    const result = await send(resolveCommand(command, ids));
    const placeholder = plan.defines.get(index);
    if (placeholder) ids.set(placeholder, Created.parse(result).id);
  }
  saveMemory(notesDir, plan.memory);
  return step.client.rpc({ method: "getProject", projectId });
}

export async function applyDesired(
  client: SeedClient,
  desired: Desired,
  options: ApplyOptions,
): Promise<ApplyResult> {
  const step: Step = {
    client,
    desired,
    dryRun: options.dryRun,
    changes: [],
    print: options.print ?? (() => {}),
  };
  const project = await ensureProject(step, options.folder);
  if (project) await ensureNotesDir(step, project, options.notesDir);
  else step.changes.push({ kind: "created", what: "notesDir", detail: options.notesDir });
  const projectId = project?.id ?? null;
  await ensureProfileAndGuidelines(step, projectId);
  await ensurePages(step, projectId, options.manifestVersions);
  const after = await ensureTickets(step, projectId, options.notesDir);
  step.changes.push(
    ...writeNotes(options.notesDir, desired.notes, ticketKeys(after), { dryRun: options.dryRun }),
  );
  return { projectId, counts: buildReport(step.changes), changes: step.changes };
}
