import { resolveRefs } from "@kibo/core/project-agent/apply-plan";
import { predictKeys } from "@kibo/core/project-agent/predict-keys";
import { type ActionProblem, validateBatch } from "@kibo/core/project-agent/validate";
import {
  ACTION_DETAIL_MAX,
  type ActionResult,
  type Actor,
  KiboError,
  type PlanAction,
  type PlanCreated,
  type PlanOutcome,
  type PlanPreview,
  type PlanProblem,
  type ProjectEventSink,
  type ProposedAction,
} from "@kibo/schema";
import { type ActionRunnerDeps, type Created, runAction } from "../project-agent/apply-actions";
import type { ProjectAgentDataPort } from "../project-agent/types";
import { planContext } from "./plan-context";

type PlanServiceDeps = { data: ProjectAgentDataPort; events?: ProjectEventSink };

export type PlanService = {
  preview(projectId: string, actions: readonly PlanAction[]): PlanPreview;
  apply(projectId: string, actions: readonly PlanAction[]): Promise<PlanOutcome>;
};

const PLAN_SUMMARY = "plan";

const result = (
  action: ProposedAction,
  outcome: ActionResult["outcome"],
  detail: string | null = null,
  created: Created | null = null,
): ActionResult => ({
  actionId: action.id,
  outcome,
  detail: detail?.slice(0, ACTION_DETAIL_MAX) ?? null,
  created,
});

const problemsOf = (problems: readonly ActionProblem[]): PlanProblem[] =>
  problems.map(({ actionId, type, message }) => ({ actionId, type, message }));

type Step = { result: ActionResult; failed: boolean };

async function step(deps: ActionRunnerDeps, action: ProposedAction): Promise<Step> {
  const resolved = resolveRefs(action, deps.refs, deps.ctx.project);
  if (!resolved.ok) return { result: result(action, "failed", resolved.reason), failed: true };
  try {
    const created = await runAction(deps, action, resolved.ids);
    if (created && action.type === "createTicket") deps.refs.set(action.ref, created);
    return { result: result(action, "applied", null, created), failed: false };
  } catch (e) {
    if (e instanceof KiboError) return { result: result(action, "failed", e.detail), failed: true };
    throw e;
  }
}

function createdOf(actions: readonly ProposedAction[], refs: ReadonlyMap<string, Created>): PlanCreated[] {
  return actions.flatMap((action) => {
    if (action.type !== "createTicket") return [];
    const created = refs.get(action.ref);
    return created ? [{ ref: action.ref, ...created }] : [];
  });
}

async function run(deps: ActionRunnerDeps, actions: readonly ProposedAction[]): Promise<PlanOutcome> {
  const results: ActionResult[] = [];
  let stoppedAt: number | null = null;
  for (const action of [...actions].sort((a, b) => a.id - b.id)) {
    if (stoppedAt !== null) {
      results.push(result(action, "skipped", `arrêt après l'échec de #${stoppedAt}`));
      continue;
    }
    const done = await step(deps, action);
    results.push(done.result);
    if (done.failed) stoppedAt = action.id;
  }
  return { problems: [], results, created: createdOf(actions, deps.refs), stoppedAt };
}

export function createPlanService({ data, events }: PlanServiceDeps): PlanService {
  const validate = (projectId: string, actions: readonly PlanAction[]) => {
    const ctx = planContext(data, projectId);
    return { ctx, checked: validateBatch({ summary: PLAN_SUMMARY, actions: [...actions] }, ctx) };
  };
  return {
    preview(projectId, actions) {
      const { checked } = validate(projectId, actions);
      if (!checked.ok) return { ok: false, problems: problemsOf(checked.problems) };
      return { ok: true, keys: predictKeys(checked.batch.actions, data.forecast(projectId)) };
    },
    async apply(projectId, actions) {
      const { ctx, checked } = validate(projectId, actions);
      if (!checked.ok)
        return { problems: problemsOf(checked.problems), results: [], created: [], stoppedAt: null };
      const by: Actor = { kind: "human", ref: ctx.viewer };
      return run({ data, projectId, by, ctx, refs: new Map(), events }, checked.batch.actions);
    },
  };
}
