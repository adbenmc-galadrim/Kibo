import type { OldQuestion, OldTicket } from "./old-project";

export type QuestionRule = string | { drop: string };
export type QuestionRules = Readonly<Record<string, QuestionRule>>;

const TWIN = { drop: "doublon de sa version préfixée « Client - » ou « Galadrim - »" };
const WORKLOAD = { drop: "charge globale sans étape cible, gardée dans la sauvegarde" };
const AGENT_RUN = { drop: "mécanique d'un ancien run d'agent, sans objet en suivi seul" };

export const QUESTION_PLACEMENT: QuestionRules = {
  Q1: TWIN,
  Q2: TWIN,
  Q3: TWIN,
  Q4: TWIN,
  Q5: TWIN,
  Q6: TWIN,
  Q7: TWIN,
  Q8: TWIN,
  Q9: TWIN,
  Q10: TWIN,
  Q11: TWIN,
  Q12: TWIN,
  Q15: TWIN,
  Q16: TWIN,
  "95c11be3-ca9b-485a-b88b-451d8bf4c5c1": TWIN,
  Q13: WORKLOAD,
  "b2379b3c-1c50-4cd0-a5b3-bfc087d00232": WORKLOAD,
  "dc1707fc-4429-4bb6-adc2-72c542179bd5": AGENT_RUN,
  "89583b3d-970a-41fd-a6e4-bc5968a7e7cf": AGENT_RUN,
  "f56e651a-0a88-4d9c-a687-2fb8fe0bdc4f": AGENT_RUN,
  "8f878e59-fd78-465d-92d1-01b544fc14a2": AGENT_RUN,
  "2e4404c3-1836-4f2c-a40c-460bb461cf4e": AGENT_RUN,
  "c326d8a3-6595-487b-bd4f-b50237cbdb90": AGENT_RUN,
  "38d34027-6373-4b93-8bc6-ee570dcc61f1": AGENT_RUN,
  "89ed385f-d30c-4168-89cc-f29991f2c038": AGENT_RUN,
  "cb1d9f56-7ef9-4486-97e2-4a4d76032374": AGENT_RUN,
  "bb48d4bd-4092-405a-8959-96d259c0a833": AGENT_RUN,
};

export const UNPLACED = "unplaced";

export type QuestionContext = {
  kept: readonly OldTicket[];
  overrides: QuestionRules;
};

export function ruleOf(q: OldQuestion, rules: QuestionRules): QuestionRule | undefined {
  return (q.importRef ? rules[q.importRef.id] : undefined) ?? rules[q.id];
}

const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cites = (text: string, token: string): boolean =>
  new RegExp(`(^|[^\\w-])${literal(token)}($|[^\\w-])`).test(text);

function byOverride(q: OldQuestion, ctx: QuestionContext): OldTicket | undefined {
  const target = ruleOf(q, ctx.overrides);
  if (typeof target !== "string") return undefined;
  return ctx.kept.find((t) => t.planId === target || t.key === target);
}

function byBlockedReason(q: OldQuestion, ctx: QuestionContext): OldTicket | undefined {
  const id = q.importRef?.id;
  if (id === undefined) return undefined;
  return ctx.kept.find((t) => t.blockedReason !== null && cites(t.blockedReason, id));
}

function byCitation(q: OldQuestion, ctx: QuestionContext, isRoot: boolean): OldTicket | undefined {
  const text = `${q.title}\n${q.context}`;
  return ctx.kept.find(
    (t) => t.planId !== null && (t.parentKey === null) === isRoot && cites(text, t.planId),
  );
}

export function questionTarget(q: OldQuestion, ctx: QuestionContext): string {
  const found =
    byOverride(q, ctx) ?? byBlockedReason(q, ctx) ?? byCitation(q, ctx, false) ?? byCitation(q, ctx, true);
  return found?.key ?? UNPLACED;
}
