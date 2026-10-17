import { sameSprintCode } from "@kibo/schema";
import { answerQuestionCheck } from "./validate-questions";
import { type Check, nodeOf, type Scan, touch } from "./validate-scan";

const knownCode = (scan: Scan, code: string): boolean =>
  scan.sprintCodes.some((c) => sameSprintCode(c, code));

const setSprint: Check<"setSprint"> = (scan, a) => {
  if ((scan.parents.get(nodeOf(scan, a.ticket)) ?? null) !== null) return ["sprint set on the root ticket"];
  if (a.sprint !== null && !knownCode(scan, a.sprint))
    return [`sprint inconnu « ${a.sprint} » : crée-le plus tôt dans le lot par createSprint`];
  return touch(scan, `${a.ticket}.sprintId`);
};

const createSprint: Check<"createSprint"> = (scan, a) => {
  if (knownCode(scan, a.code)) return [`code de sprint déjà pris « ${a.code} »`];
  if (a.end < a.start) return ["la fin du sprint précède son début"];
  scan.sprintCodes.push(a.code);
  return [];
};

const remindQuestion: Check<"remindQuestion"> = (scan, a) => {
  const problem = answerQuestionCheck(scan, a.questionId);
  return typeof problem === "string" ? [problem] : touch(scan, `${a.questionId}.reminded`);
};

export const sprintChecks = { setSprint, createSprint, remindQuestion };
