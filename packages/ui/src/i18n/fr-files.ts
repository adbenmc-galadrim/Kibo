import type { KiboErrorCode, ProjectAssetKind } from "@kibo/schema";

const KIB = 1024;
const MIB = KIB * 1024;
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export const formatBytes = (bytes: number): string => {
  if (bytes < KIB) return `${bytes} o`;
  if (bytes < MIB) return `${decimal.format(bytes / KIB)} Kio`;
  return `${decimal.format(bytes / MIB)} Mio`;
};

const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const KINDS: Record<ProjectAssetKind, string> = { model: "Modèle", image: "Image", audio: "Son" };

const TOO_LARGE = "Trop gros : 64 Mio maximum.";

const ERRORS: Partial<Record<KiboErrorCode, string>> = {
  TOO_LARGE,
  QUOTA_EXCEEDED: "Dossier plein : 512 Mio maximum.",
  CONFLICT: "Un fichier porte déjà ce nom.",
  INVALID_INPUT: "Le contenu ne correspond pas à l'extension.",
  RATE_LIMITED: "4 envois en cours au maximum : attends la fin d'un envoi.",
  NOT_FOUND: "Envoi expiré après 10 min d'inactivité : relance l'import.",
  INTERNAL: "Ce dossier ne permet pas les liens durs : choisis un autre dossier.",
};

export const frFiles = {
  title: "Fichiers du projet",
  help: "Modèles 3D, images et sons utilisables par les composants. Ils restent sur cet appareil.",
  folder: (dir: string, used: number) => `Dossier : ${dir} · ${formatBytes(used)} utilisés`,
  folderLoading: "Dossier : chargement…",
  change: "Changer…",
  import: "Importer…",
  pick: "Choisir des fichiers à importer",
  drop: "Dépose des fichiers ici : .glb, images (.png, .jpg, .webp, .gif), sons (.mp3, .ogg, .wav).",
  empty: "Aucun fichier. Exporte depuis Blender en glTF Binary (.glb), ou dépose des images et des sons.",
  loading: "Chargement des fichiers…",
  loadFailed: "Impossible de lister les fichiers du projet.",
  list: "Fichiers du projet",
  columns: { name: "Nom", kind: "Genre", size: "Taille", date: "Date" },
  kinds: KINDS,
  kind: (kind: ProjectAssetKind) => KINDS[kind],
  size: formatBytes,
  date: (ms: number) => day.format(new Date(ms)),
  uploads: "Envois en cours",
  uploading: (name: string) => `Envoi de ${name}`,
  uploadPercent: (percent: number) => `${percent} %`,
  finishing: "Finalisation…",
  uploaded: "Importé",
  remove: "Supprimer",
  removeLabel: (name: string) => `Supprimer ${name}`,
  removeTitle: (name: string) => `Supprimer ${name} ?`,
  removeHelp:
    "Le fichier est effacé de cet appareil. Les widgets qui l'utilisent afficheront « Fichier introuvable ».",
  cancel: "Annuler",
  close: "Fermer",
  unsupported: (name: string) => {
    const dot = name.lastIndexOf(".");
    return `Format non pris en charge : ${dot < 0 ? name : name.slice(dot).toLowerCase()}`;
  },
  emptyFile: "Fichier vide.",
  tooLarge: TOO_LARGE,
  problem: (name: string, message: string) => `${name} · ${message}`,
  error: (code: KiboErrorCode | null) => (code && ERRORS[code]) ?? "Impossible d'envoyer le fichier.",
  removeFailed: "Impossible de supprimer le fichier.",
  dir: {
    title: "Dossier des fichiers",
    help: "Chemin absolu d'un dossier sur cette machine. Vide : dossier par défaut. Les fichiers déjà importés ne sont pas déplacés.",
    label: "Dossier",
    submit: "Enregistrer",
    failed: "Dossier introuvable ou illisible.",
  },
};
