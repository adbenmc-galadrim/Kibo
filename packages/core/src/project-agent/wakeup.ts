import { type AnsweredLine, answeredLine, WAKE_WINDOW_MS, WAKEUP_PREFIX } from "@kibo/schema";

export type WakePlan = { kind: "now" } | { kind: "scheduled"; at: number } | { kind: "already"; at: number };

export function planWakeup(input: {
  lastAt: number | null;
  dueAt: number | null;
  now: number;
  window?: number;
}): WakePlan {
  if (input.dueAt !== null) return { kind: "already", at: input.dueAt };
  const window = input.window ?? WAKE_WINDOW_MS;
  if (input.lastAt === null || input.now - input.lastAt >= window) return { kind: "now" };
  return { kind: "scheduled", at: input.lastAt + window };
}

const ANSWER_RULE =
  "Lis chaque réponse (`list_questions`, `get_ticket`) et propose un lot seulement si elle appelle une action : lever un blocage (`setStatus`), ajuster ou reprendre une étape (`updateTicket`, `setHold`), prévenir le client (`createQuestion` à son destinataire) ; sinon dis en une phrase ce que tu en retiens, sans lot.";

const counted = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

export function wakeupMessage(answers: readonly AnsweredLine[]): string {
  const read = counted(answers.length, "réponse à lire", "réponses à lire");
  const lines = answers.map(answeredLine).join("\n");
  return `${WAKEUP_PREFIX}${read}.\n${lines}\n${ANSWER_RULE}`;
}
