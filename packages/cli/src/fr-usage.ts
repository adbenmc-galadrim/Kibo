export const DAEMON_HELP = "Démon : $KIBO_HOME/daemon.json (défaut ~/.kibo), ou --home <dossier>";
export const PROJECT_HINT =
  "Projet : --project, sinon le préfixe de la clé (SILO-12), sinon le dossier courant ; une clé F<n> ne suffit pas.";
export const TEXT_HINT = "Textes : <texte>, @fichier (relatif au dossier courant) ou @- (entrée standard).";

export const usageText = (lines: readonly string[], ...notes: string[]): string =>
  ["Usage :", ...lines, "", ...notes].join("\n");
