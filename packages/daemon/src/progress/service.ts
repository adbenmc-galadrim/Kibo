import {
  doingStep,
  KiboError,
  type ProgressInput,
  type ProjectCommand,
  type ProjectSnapshot,
  progressReply,
  progressSummary,
  type RunProgressSummary,
  type RunView,
  reportOfRun,
  type TicketProgress,
} from "@kibo/schema";
import type { GitRunner } from "../agents/workspace-prep";
import type { CommandMeta } from "../docs";
import { changedFiles, checkFiles } from "./file-check";

type Snapshot = Pick<ProjectSnapshot, "tickets">;
type ProgressUpdate = Omit<
  Extract<ProjectCommand, { method: "setTicketProgress" }>,
  "method" | "ticketId" | "runId" | "at"
>;

export type ProgressDocs = {
  snapshot(projectId: string): Snapshot;
  run(projectId: string, cmd: ProjectCommand, meta: CommandMeta): unknown;
};
export type ProgressTrace = {
  setDoingStep(runId: string, stepId: string | null): void;
  setBaseHead(runId: string, head: string | null): void;
  trace(runId: string): { baseHead: string | null } | null;
};
export type ProgressDeps = {
  docs: ProgressDocs;
  git: GitRunner;
  trace: ProgressTrace;
  now: () => number;
  changed?: () => void;
};
export type ProgressService = {
  record(run: RunView, input: ProgressInput): Promise<string>;
  onSpawned(run: RunView): Promise<void>;
  onTurnEnd(run: RunView): Promise<void>;
  summary(run: RunView): RunProgressSummary | null;
  hasPlan(run: RunView): boolean;
  hasReport(run: RunView): boolean;
  summaries(runs: readonly RunView[]): RunProgressSummary[];
};

type TicketRun = RunView & { projectId: string; ticketId: string };

const FROM_AGENT: CommandMeta = { origin: "agent", instanceId: null };

const hasTicket = (run: RunView): run is TicketRun => run.projectId !== null && run.ticketId !== null;

function ticketRun(run: RunView): TicketRun {
  if (!hasTicket(run)) throw new KiboError("INVALID_INPUT", "run without ticket");
  return run;
}

async function headOf(git: GitRunner, cwd: string | null): Promise<string | null> {
  if (cwd === null) return null;
  const res = await git(["rev-parse", "HEAD"], cwd);
  return res.code === 0 ? res.stdout.trim() || null : null;
}

export function createProgressService(deps: ProgressDeps): ProgressService {
  const { docs, git, trace, now } = deps;

  const progressOf = (run: RunView, snapshots = new Map<string, Snapshot>()): TicketProgress | null => {
    if (!hasTicket(run)) return null;
    const snapshot = snapshots.get(run.projectId) ?? docs.snapshot(run.projectId);
    snapshots.set(run.projectId, snapshot);
    return snapshot.tickets.find((t) => t.id === run.ticketId)?.agentProgress ?? null;
  };

  const write = (run: TicketRun, update: ProgressUpdate) => {
    docs.run(
      run.projectId,
      { method: "setTicketProgress", ticketId: run.ticketId, runId: run.id, at: now(), ...update },
      FROM_AGENT,
    );
    deps.changed?.();
  };

  async function record(run: RunView, input: ProgressInput): Promise<string> {
    write(ticketRun(run), input);
    if (input.plan !== undefined) trace.setDoingStep(run.id, doingStep(input.plan)?.id ?? null);
    return progressReply(input);
  }

  async function onSpawned(run: RunView): Promise<void> {
    if (trace.trace(run.id)?.baseHead) return;
    trace.setBaseHead(run.id, await headOf(git, run.cwd));
  }

  async function onTurnEnd(run: RunView): Promise<void> {
    const progress = progressOf(run);
    const report = progress && reportOfRun(progress, run.id);
    const baseHead = trace.trace(run.id)?.baseHead ?? null;
    if (!report || baseHead === null || run.cwd === null || !hasTicket(run)) return;
    const changed = await changedFiles(git, run.cwd, baseHead);
    if (changed === null) return;
    write(run, { check: checkFiles(report.files, changed) });
  }

  const summary = (run: RunView, snapshots?: Map<string, Snapshot>): RunProgressSummary | null => {
    const progress = progressOf(run, snapshots);
    return progress && progressSummary(run.id, progress);
  };

  return {
    record,
    onSpawned,
    onTurnEnd,
    summary: (run) => summary(run),
    hasPlan: (run) => progressOf(run)?.planRunId === run.id,
    hasReport: (run) => {
      const progress = progressOf(run);
      return progress !== null && reportOfRun(progress, run.id) !== null;
    },
    summaries: (runs) => {
      const snapshots = new Map<string, Snapshot>();
      return runs.flatMap((run) => summary(run, snapshots) ?? []);
    },
  };
}
