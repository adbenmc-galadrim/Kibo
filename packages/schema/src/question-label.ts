import type { Question } from "./question";

const QUESTION_REF = /^Q\d+$/;

export function questionLabel(q: Pick<Question, "number" | "importRef">): string {
  if (q.importRef !== null && QUESTION_REF.test(q.importRef.id)) return q.importRef.id;
  return q.number === null ? "Q?" : `Q${q.number}`;
}
