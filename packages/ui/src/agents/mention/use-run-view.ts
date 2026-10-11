import {
  type AgentsState,
  type RunMoment,
  type RunReport,
  type RunView,
  reportOfRun,
  type TicketProgress,
} from "@kibo/schema";
import { useRunMoments } from "../../moments/use-run-moments";
import { useAgentsState } from "../../state/agents-context";
import { useProject } from "../../state/use-projects";
import { type ShownPlan, shownPlan } from "../dock/DockPlan";

export type RunViewData = {
  agents: AgentsState | null;
  run: RunView | null;
  moments: RunMoment[];
  shown: ShownPlan | null;
  report: RunReport | null;
  loading: boolean;
  failed: boolean;
};

export const newestFirst = (runs: readonly RunView[]): RunView[] =>
  [...runs].sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq);

export const lastReport = (progress: TicketProgress): RunReport | null =>
  progress.reports.reduce<RunReport | null>((last, r) => (last === null || r.at >= last.at ? r : last), null);

export function useRunView(runId: string): RunViewData {
  const agents = useAgentsState();
  const run = agents?.runs.find((r) => r.id === runId) ?? null;
  const { page, loading, error } = useRunMoments(run ? run.id : null);
  const project = useProject(run?.projectId ?? null);
  const progress = project?.tickets.find((t) => t.id === run?.ticketId)?.agentProgress ?? null;
  return {
    agents,
    run,
    moments: page?.moments ?? [],
    loading,
    failed: error !== null,
    shown: run ? shownPlan(progress, run.id, page?.internalPlan ?? null) : null,
    report: run && progress ? (reportOfRun(progress, run.id) ?? lastReport(progress)) : null,
  };
}
