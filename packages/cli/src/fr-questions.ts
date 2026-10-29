import { DAEMON_HELP, PROJECT_HINT, TEXT_HINT, usageText } from "./fr-usage";

export const QUESTIONS_USAGE = [
  "  kibo questions list <clé> [--all] [--project <p>] [--json]",
  '  kibo questions add <clé> "<titre>" --option "A" [--option "B"…] [--context …] [--recipient <nom|id>] [--provisional "A"] [--blocking] [--project <p>] [--json]',
  '  kibo questions answer <id|n°> "<réponse>" --project <p> [--json]',
];

export const frQuestions = {
  usage: usageText(QUESTIONS_USAGE, PROJECT_HINT, TEXT_HINT, DAEMON_HELP),
  blocking: "bloquante",
  none: (ticket: string) => `Aucune question sur ${ticket}.`,
  added: (label: string, ticket: string) => `✓ Question ${label} ajoutée sur ${ticket}`,
  answered: (label: string, answer: string) => `✓ Question ${label} répondue : ${answer}`,
  notFound: (ident: string) => `Question introuvable : ${ident}`,
  provisionalOutside: "Le choix provisoire doit être une des options.",
  unknownRecipient: (raw: string, names: readonly string[]) =>
    `Destinataire inconnu : ${raw}. Destinataires : ${names.join(", ")}`,
};
