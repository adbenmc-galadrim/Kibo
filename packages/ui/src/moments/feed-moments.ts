import {
  actionsFailed,
  type RunAction,
  type RunMoment,
  type RunSubagent,
  summarizeActions,
} from "@kibo/schema";

export type FeedScope = {
  showReasoning: boolean;
  subagentId: string | null;
  subagents: ReadonlyMap<string, RunSubagent>;
};

const launchedCalls = (subagents: ReadonlyMap<string, RunSubagent>): Set<string> =>
  new Set([...subagents.values()].flatMap((s) => (s.toolUseId === null ? [] : [s.toolUseId])));

const isLaunchOf = (calls: ReadonlySet<string>) => (a: RunAction) =>
  a.kind === "subagent" && a.callId !== undefined && calls.has(a.callId);

function withoutLaunches(moment: RunMoment, calls: ReadonlySet<string>): RunMoment | null {
  const data = moment.data;
  if (data.kind !== "actions") return moment;
  const launched = isLaunchOf(calls);
  if (!data.actions.some(launched)) return moment;
  const [first, ...rest] = data.actions.filter((a) => !launched(a));
  if (!first) return null;
  const actions = [first, ...rest];
  return {
    ...moment,
    data: { ...data, actions, summary: summarizeActions(actions), failed: actionsFailed(actions) },
  };
}

function shown(moment: RunMoment, scope: FeedScope): boolean {
  if ((moment.subagentId ?? null) !== scope.subagentId) return false;
  if (moment.data.kind === "reasoning") return scope.showReasoning;
  if (moment.data.kind === "subagent") return scope.subagents.has(moment.data.subagentId);
  return true;
}

export function feedMoments(moments: readonly RunMoment[], scope: FeedScope): RunMoment[] {
  const calls = launchedCalls(scope.subagents);
  return moments.flatMap((m) => {
    if (!shown(m, scope)) return [];
    const kept = withoutLaunches(m, calls);
    return kept ? [kept] : [];
  });
}
