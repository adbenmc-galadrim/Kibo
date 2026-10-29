import { DAEMON_HELP, PROJECT_HINT, TEXT_HINT, usageText } from "./fr-usage";

export const FEATURES_USAGE = [
  '  kibo features create "<titre>" [--sprint <S>] [--description <texte|@fichier|@->] [--labels a,b] [--project <p>] [--json]',
];

export const TICKETS_WRITE_USAGE = [
  '  kibo tickets create "<titre>" --feature <F|clé> [--description …] [--labels a,b] [--optional] [--project <p>] [--json]',
  "  kibo tickets update <clé> [--title <t>] [--description …|--append …|--prepend …] [--labels a,b] [--project <p>] [--json]",
  "  kibo tickets move <clé> --feature <F|clé> [--project <p>] [--json]",
  "  kibo tickets link <A> --blocks <B> [--project <p>] [--json]",
  "  kibo tickets unlink <A> <B> [--project <p>] [--json]",
];

export const frFeatures = {
  usage: usageText(FEATURES_USAGE, PROJECT_HINT, TEXT_HINT, DAEMON_HELP),
};
