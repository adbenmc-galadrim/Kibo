import type { OldQuestion, OldTicket } from "./old-project";

export const QUESTION_PLACEMENT: Record<string, string> = {};

export const UNPLACED = "unplaced";

export type QuestionContext = {
  kept: readonly OldTicket[];
  overrides: Readonly<Record<string, string>>;
};

const literal = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cites = (text: string, token: string): boolean =>
  new RegExp(`(^|[^\\w-])${literal(token)}($|[^\\w-])`).test(text);

function byOverride(q: OldQuestion, ctx: QuestionContext): OldTicket | undefined {
  const target = q.importRef ? ctx.overrides[q.importRef.id] : undefined;
  if (target === undefined) return undefined;
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
