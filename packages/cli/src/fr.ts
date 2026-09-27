const MARKET_USAGE = [
  "  kibo market keygen --out <fichier>",
  "  kibo market pack <id>@<version> [--out <fichier>] [--publisher <nom>]",
  "  kibo market index --dir <dossier> --key <fichier> --id <source> --name <nom> [--verify <clés>]",
];

export const fr = {
  usage: [
    "Usage :",
    "  kibo component new <id> [--kind widget|view|both] [--server]",
    "  kibo component test <id|dossier>",
    "  kibo component dev <id|dossier> [--port <n>]",
    "  kibo component publish <id> [--update-all|--new-version]",
    "  kibo component publish <id> --to <source> [--publisher <nom>]",
    ...MARKET_USAGE,
  ].join("\n"),
  marketUsage: ["Usage :", ...MARKET_USAGE].join("\n"),
  keyWritten: (file: string, fingerprint: string) =>
    `Clé de source écrite dans ${file} · empreinte SHA256 ${fingerprint}`,
  packWritten: (file: string) => `Paquet écrit dans ${file}`,
  indexSigned: (serial: number, packages: number) =>
    `Index n° ${serial} signé (${packages} paquet${packages > 1 ? "s" : ""})`,
  marketPublished: (source: string, serial: number) => `Publié sur ${source} : index n° ${serial}`,
  created: (dir: string) => `Composant créé : ${dir}`,
  next: (id: string) => `Ensuite : kibo component dev ${id}, puis kibo component test ${id}`,
  step: (name: string, ok: boolean) => `${ok ? "✓" : "✗"} ${name}`,
  steps: {
    manifest: "Manifeste",
    imports: "Imports",
    typecheck: "Types",
    tests: "Tests",
    conformance: "Conformité",
    permissions: "Permissions",
  },
  tests: (passed: number, failed: number) =>
    `Tests : ${passed} réussi${passed > 1 ? "s" : ""}, ${failed} en échec`,
  missing: (p: string) => `  permission utilisée mais non déclarée : ${p}`,
  unused: (p: string) => `  permission déclarée mais inutilisée : ${p}`,
  valid: "Composant valide : il apparaît dans « Mes composants ».",
  invalid: "Composant invalide.",
  dev: (url: string) => `Aperçu : ${url} (Ctrl+C pour arrêter)`,
  noDaemon: "Le démon Kibo ne tourne pas : lance l'application Kibo, puis réessaie.",
  daemonInfoCorrupt: (file: string) =>
    `Le fichier ${file} est corrompu : relance l'application Kibo, ou supprime ce fichier puis réessaie.`,
  pairingFailed: "Appairage refusé : le jeton de ~/.kibo/token ne correspond pas.",
  strategyRequired: (n: number) =>
    `Ce composant est utilisé par ${n} instance${n > 1 ? "s" : ""} : ajoute --update-all ou --new-version.`,
  unchanged: "Rien à publier : cette version est déjà publiée avec le même code.",
  published: (version: string) => `Version ${version} publiée.`,
  needsApproval: "Autorisation requise : ouvre Kibo (écran « Composants ») pour l'accorder.",
  partial: (n: number) =>
    `${n} instance${n > 1 ? "s" : ""} restée${n > 1 ? "s" : ""} sur l'ancienne version :`,
  failedLine: (project: string, page: string, message: string) => `  ${project} › ${page} — ${message}`,
  error: (code: string, message: string) => `Erreur ${code} : ${message}`,
};
