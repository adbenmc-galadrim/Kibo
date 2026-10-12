import type { AutoLinkReason, OverlapKind } from "@kibo/schema";

const day = (at: number) => new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const time = (at: number) => new Date(at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export const frOverlapsSettings = {
  settings: {
    legend: "Doublons entre agents",
    help: "Kibo compare le travail des runs actifs du projet à chaque écriture et toutes les 5 minutes, sans token. Désactivé, la section « Travail en cours » reste.",
    enabled: "Détecter les doublons entre agents",
    minLines: "Lignes minimales d'un bloc",
    minLinesHelp: "4 à 50 ; un bloc fait aussi 160 caractères au moins.",
    minLinesError: "Choisis un nombre entre 4 et 50.",
    compareTests: "Comparer aussi les tests",
    compareTestsHelp: "Tests et fixtures sont exclus des blocs par défaut.",
    ignore: "Fichiers ignorés",
    ignoreHelp: "Un glob par ligne, en plus des verrous, fichiers générés, binaires et secrets.",
    ignoreTooMany: "50 globs au plus.",
    ignoreTooLong: "Un glob fait 200 caractères au plus.",
    genericExports: "Exports génériques",
    genericExportsHelp: "Un nom exporté deux fois parmi ceux-ci ne déclenche pas d'alerte.",
    addExport: "Ajouter…",
    addExportLabel: "Ajouter un export générique",
    removeExport: (name: string) => `Retirer ${name}`,
    exportsTooMany: "100 exports au plus.",
    exportTooLong: "Un nom fait 64 caractères au plus.",
    ignored: "Recouvrements ignorés",
    ignoredHelp: "Un recouvrement ignoré ne réalerte plus, pour aucun run du projet.",
    none: "Aucun",
    kinds: { file: "fichier", export: "export", block: "bloc" } satisfies Record<OverlapKind, string>,
    ignoredBy: (at: number, by: string) => `${day(at)} · ${by}`,
    reactivate: "Réactiver",
    reactivateLabel: (label: string) => `Réactiver ${label}`,
    failed: "Impossible de lire les recouvrements ignorés.",
    localOnly: "Réglage local : il se modifie sur l'ordinateur où tourne Kibo.",
  },
  badge: {
    byKibo: "par Kibo",
    label: (key: string) => `Lien ajouté par Kibo avec ${key}`,
    reason: { copy: "Reprise de", import: "Import de" } satisfies Record<AutoLinkReason, string>,
    at: (at: number) => `${day(at)} ${time(at)}`,
    cancel: "Annuler",
    failed: "Impossible d'annuler le lien.",
  },
  preview: {
    work: "Travail en cours sur le projet (exemple)",
  },
} as const;
