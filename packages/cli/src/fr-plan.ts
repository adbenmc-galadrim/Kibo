import type { FeatureStatus, SprintState } from "@kibo/schema";
import { DAEMON_HELP, usageText } from "./fr-usage";

export const PLAN_USAGE = [
  "  kibo plan apply <fichier.yaml|json> [--dry-run] --project <p> [--json]",
  "  kibo plan export [--md] --project <p>",
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const frPlan = {
  usage: usageText(PLAN_USAGE, DAEMON_HELP),
  unknownField: (name: string, fields: readonly string[]) =>
    `Champ inconnu : ${name}. Champs : ${fields.join(", ")}`,
  markdown: {
    unplanned: "Sans sprint",
    lone: "Hors fonctionnalité",
    sprintState: { done: "terminé", current: "en cours", planned: "prévu" } satisfies Record<
      SprintState,
      string
    >,
    featureStatus: {
      todo: "à faire",
      open: "ouverte",
      blocked: "bloquée",
      late: "en retard",
      delivered: "livrée",
    } satisfies Record<FeatureStatus, string>,
    waiting: (keys: readonly string[]) => `attend ${keys.join(", ")}`,
    optional: "facultative",
    onHold: (reason: string) => `en attente : ${reason}`,
    questions: (n: number) => plural(n, "question ouverte", "questions ouvertes"),
  },
};
