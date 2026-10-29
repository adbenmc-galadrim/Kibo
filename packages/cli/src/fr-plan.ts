import { DAEMON_HELP, usageText } from "./fr-usage";

export const PLAN_USAGE = [
  "  kibo plan apply <fichier.yaml|json> [--dry-run] --project <p> [--json]",
  "  kibo plan export [--md] --project <p>",
];

export const frPlan = {
  usage: usageText(PLAN_USAGE, DAEMON_HELP),
  unknownField: (name: string, fields: readonly string[]) =>
    `Champ inconnu : ${name}. Champs : ${fields.join(", ")}`,
};
