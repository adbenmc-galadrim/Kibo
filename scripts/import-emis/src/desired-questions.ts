import { type ImportRef, QUESTION_CONTEXT_MAX, QUESTION_TITLE_MAX } from "@kibo/schema";
import { stripInlineMarkup, truncate } from "./markdown";
import { type Answers, type EmisPlan, flatPrs, type PlanQuestion } from "./plan-source";

export type DesiredAnswer = { text: string; at: string | null };
export type DesiredQuestion = {
  ref: ImportRef;
  ticket: ImportRef;
  title: string;
  context: string;
  blocking: true;
  answer: DesiredAnswer | null;
};

export const ARBITRAGES_ID = "arbitrages";
export const RESOLVED_IN_PLAN = "Résolue dans le plan Emis";

const planRef = (id: string): ImportRef => ({ kind: "import_ref", source: "plan", id });

function answerOf(q: PlanQuestion, answers: Answers, planDate: string): DesiredAnswer | null {
  const given = answers[q.ref];
  const text = given?.status === "answered" ? given.answer.trim() : "";
  if (given && text) return { text, at: given.at };
  return q.resolved ? { text: RESOLVED_IN_PLAN, at: planDate } : null;
}

function contextOf(question: string, title: string, group: string): string {
  const groupLine = `Groupe : ${group}`;
  const cut = title !== stripInlineMarkup(question);
  return truncate(cut ? `${question}\n\n${groupLine}` : groupLine, QUESTION_CONTEXT_MAX);
}

function questionOf(
  q: PlanQuestion,
  group: string,
  known: ReadonlySet<string>,
  answers: Answers,
  planDate: string,
): DesiredQuestion {
  const title = truncate(stripInlineMarkup(q.question), QUESTION_TITLE_MAX);
  return {
    ref: planRef(q.ref),
    ticket: planRef(known.has(q.blocks) ? q.blocks : ARBITRAGES_ID),
    title,
    context: contextOf(q.question, title, group),
    blocking: true as const,
    answer: answerOf(q, answers, planDate),
  };
}

export function desiredQuestions(plan: EmisPlan, answers: Answers): DesiredQuestion[] {
  const known = new Set(flatPrs(plan).map((p) => p.id));
  return plan.arbitrages.flatMap((group) =>
    group.items.map((q) => questionOf(q, group.group, known, answers, plan.meta.updatedAt)),
  );
}
