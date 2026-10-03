import type { SourceIssue, SourceIssueCode } from "./issues";

const ISSUES: Record<SourceIssueCode, (detail: string) => string> = {
  "forbidden-import": (d) => `import interdit : ${d}`,
  "outside-import": (d) => `import hors du dossier du composant : ${d}`,
  "non-literal-import": (d) => `import non littéral : ${d}`,
  "banned-identifier": (d) => `identifiant interdit : ${d}`,
  "non-literal-argument": (d) => `argument non littéral : impossible de vérifier la permission (${d})`,
  "reserved-command": (d) => `commande réservée au shell : ${d}`,
  "unknown-entity": (d) => `entité ou commande inconnue : ${d}`,
  "inference-skipped": () => "permissions non vérifiées : contrôle de types interrompu",
};

export const formatIssue = (i: SourceIssue): string => `${i.file}:${i.line} · ${ISSUES[i.code](i.detail)}`;

export const FR_DEVKIT = {
  reservedId: (id: string) => `identifiant réservé à un composant intégré : ${id}`,
  configServerReserved: "{config.server} est réservé aux composants intégrés",
  reservedMcpServer: (id: string) => `serveur MCP réservé à Kibo : ${id}`,
  manifestUnreadable: "kibo.component.json est absent ou n'est pas du JSON valide",
  sourcesRefused: (detail: string) => `sources refusées : ${detail}`,
  typeError: (file: string, line: number, text: string) => `${file}:${line} · ${text}`,
  noConformance: "la suite de conformité ne s'est pas exécutée (runConformance manquant)",
  fixedWidth: (file: string, token: string) =>
    `${file} : largeur fixe ${token} ; utilise les formats (sdk.format) et les variantes de conteneur (@md:, @lg:)`,
  missing: (p: string) => `permission utilisée mais non déclarée : ${p}`,
  unused: (p: string) => `permission déclarée mais jamais utilisée : ${p}`,
  timeout: (s: number) => `les tests ont dépassé ${s} s`,
  typecheckTimeout: (s: number) => `le contrôle de types a dépassé ${s} s`,
  sandboxUnavailable: (detail: string) =>
    `tests non lancés : bac à sable du système indisponible (${detail}). Sous Linux, installe bubblewrap (sudo apt install bubblewrap) puis relance.`,
};
