import type { Sprint } from "@kibo/schema";
import { DAEMON_HELP, usageText } from "./fr-usage";

export const SPRINTS_USAGE = [
  "  kibo sprints list --project <clé|nom|id> [--json]",
  "  kibo sprints create <code> [--name <nom>] --start AAAA-MM-JJ --end AAAA-MM-JJ --project <p> [--json]",
  "  kibo sprints update <code> [--code <c>] [--name <n>] [--start <d>] [--end <d>] --project <p> [--json]",
  "  kibo sprints assign <F> <S|--none> --project <p> [--json]",
];

type SprintLine = Pick<Sprint, "code" | "name" | "start" | "end">;
const STEP_SPRINT = "Le sprint d'une étape vient de sa fonctionnalité";

export const frSprints = {
  usage: usageText(SPRINTS_USAGE, DAEMON_HELP),
  invalidDate: (date: string) => `Date invalide : ${date} (AAAA-MM-JJ)`,
  endBeforeStart: "La fin du sprint précède son début.",
  created: (s: SprintLine) => `✓ Sprint ${s.code} créé : ${s.name} (${s.start} → ${s.end})`,
  updated: (s: SprintLine) => `✓ Sprint ${s.code} modifié : ${s.name} (${s.start} → ${s.end})`,
  assigned: (ticket: string, code: string) => `✓ ${ticket} : sprint ${code}`,
  cleared: (ticket: string) => `✓ ${ticket} : sans sprint`,
  sprintOnStep: (code: string, feature: string) => `${STEP_SPRINT} : posez ${code} sur ${feature}.`,
  sprintOffStep: (feature: string) => `${STEP_SPRINT} : retirez-le de ${feature}.`,
};
