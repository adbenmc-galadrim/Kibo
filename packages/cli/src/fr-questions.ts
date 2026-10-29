import { DAEMON_HELP, PROJECT_HINT, TEXT_HINT, usageText } from "./fr-usage";

export const QUESTIONS_USAGE = [
  "  kibo questions list <clé> [--all] [--project <p>] [--json]",
  '  kibo questions add <clé> "<titre>" --option "A" [--option "B"…] [--context …] [--recipient <nom|id>] [--provisional "A"] [--blocking] [--project <p>] [--json]',
  '  kibo questions answer <id|n°> "<réponse>" --project <p> [--json]',
];

export const frQuestions = {
  usage: usageText(QUESTIONS_USAGE, PROJECT_HINT, TEXT_HINT, DAEMON_HELP),
};
