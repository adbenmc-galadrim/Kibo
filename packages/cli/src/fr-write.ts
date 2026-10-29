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

export const frWrite = {
  created: (key: string, title: string, extras: readonly string[]) =>
    [`✓ ${key} créée : ${title}`, ...extras].join(" · "),
  inFeature: (title: string, feature: string) => `${title} (${feature})`,
  optional: "facultative",
  moved: (key: string, feature: string) => `✓ ${key} déplacée sous ${feature}`,
  updated: (key: string, parts: readonly string[]) => `✓ ${key} : ${parts.join(", ")}`,
  parts: { title: "titre", description: "description", labels: "étiquettes" },
  nothingToUpdate: "Rien à modifier : donnez --title, --description, --append, --prepend ou --labels.",
  exclusive: "--description, --append et --prepend s'excluent.",
};
