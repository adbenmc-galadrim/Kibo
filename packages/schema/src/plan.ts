import { z } from "zod";
import { ActionId, ActionResult, ProposedAction } from "./project-agent";

export const PLAN_ACTIONS_MAX = 500;
export const PLAN_ACTION_TYPES = [
  "createTicket",
  "updateTicket",
  "setStatus",
  "setHold",
  "link",
  "unlink",
  "createSprint",
  "setSprint",
  "createQuestion",
  "answerQuestion",
  "updateQuestion",
  "reopenQuestion",
  "deleteQuestion",
  "addRecipient",
] as const;
export type PlanActionType = (typeof PLAN_ACTION_TYPES)[number];
export type PlanAction = Extract<ProposedAction, { type: PlanActionType }>;

const PLAN_TYPES: ReadonlySet<string> = new Set(PLAN_ACTION_TYPES);

const PlanTypeGate = z
  .object({ type: z.string() })
  .passthrough()
  .superRefine((action, ctx) => {
    if (PLAN_TYPES.has(action.type)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["type"],
      message: `${action.type} is not allowed in a plan`,
      fatal: true,
    });
  });

export const PlanAction = PlanTypeGate.pipe(ProposedAction).refine((action): action is PlanAction =>
  PLAN_TYPES.has(action.type),
);
export const PlanActions = z.array(PlanAction).min(1).max(PLAN_ACTIONS_MAX);

export const PlanProblem = z.object({ actionId: ActionId, type: z.string(), message: z.string() });
export type PlanProblem = z.infer<typeof PlanProblem>;

export const PlanPreview = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), keys: z.record(z.string(), z.string().nullable()) }),
  z.object({ ok: z.literal(false), problems: z.array(PlanProblem) }),
]);
export type PlanPreview = z.infer<typeof PlanPreview>;

export const PlanCreated = z.object({ ref: z.string(), ticketId: z.string(), key: z.string() });
export type PlanCreated = z.infer<typeof PlanCreated>;

export const PlanOutcome = z.object({
  problems: z.array(PlanProblem),
  results: z.array(ActionResult),
  created: z.array(PlanCreated),
  stoppedAt: z.number().int().nullable(),
});
export type PlanOutcome = z.infer<typeof PlanOutcome>;

export const KeyForecast = z.object({
  nextTicketKey: z.string().nullable(),
  nextFeatureSeq: z.number().int().positive().nullable(),
  usedShortKeys: z.array(z.string()),
});
export type KeyForecast = z.infer<typeof KeyForecast>;
