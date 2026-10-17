import type { FeatureStatus } from "@kibo/schema";
import type { SprintMove } from "../shell/sprint/sprint-proposal";

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

const moveText = (m: SprintMove) =>
  m.to === null ? `retirer ${m.shortKey} du planning` : `reporter ${m.shortKey} en ${m.to}`;

export const frSprint = {
  title: (code: string, name: string) => `${code} · ${name}`,
  state: { done: "terminé", current: "en cours", planned: "à venir" },
  endsToday: "finit ce soir",
  endsIn: (days: number) => `finit dans ${days} j`,
  ended: (date: string) => `terminé le ${date}`,
  starts: (date: string) => `commence le ${date}`,
  delivered: (n: number, total: number) => `${n} ${plural(n, "livrée", "livrées")} sur ${total}`,
  features: "Fonctionnalités du sprint",
  empty: "Aucune fonctionnalité planifiée dans ce sprint.",
  steps: (key: string) => `Étapes de ${key}`,
  badge: {
    todo: "à faire",
    open: "ouverte",
    blocked: "bloquée",
    late: "en retard",
    delivered: "livrée",
  } satisfies Record<FeatureStatus, string>,
  edit: "Modifier",
  openInTab: "Ouvrir dans un onglet",
  footer: "Ce qui reste à la fin du sprint est reporté à la main, sur proposition de l'agent de projet.",
  report: {
    label: "Proposition de l'agent de projet",
    text: (moves: readonly SprintMove[]) => {
      const text = moves.map(moveText).join(", ");
      return `Fin de sprint : ${text} ?`;
    },
    apply: "Valider",
    reject: "Refuser",
    rejectTitle: (seq: number) => `Refuser le lot n° ${seq} ?`,
    rejectHelp: "Tout le lot est refusé, y compris ses autres actions ; l'agent de projet en est informé.",
    cancel: "Annuler",
    failed: "Impossible d'appliquer la décision.",
  },
  dialog: {
    title: (code: string) => `Modifier le sprint ${code}`,
    description: "Un sprint a un code court (S42), un nom et des dates.",
    code: "Code",
    name: "Nom",
    start: "Début",
    end: "Fin",
    reversed: "La fin doit suivre le début.",
    save: "Enregistrer",
    cancel: "Annuler",
    remove: "Supprimer",
    removeTitle: (code: string) => `Supprimer le sprint ${code} ?`,
    removeHelp: (n: number) =>
      n === 0
        ? "Aucune fonctionnalité n'est planifiée dans ce sprint."
        : `${n} ${plural(n, "fonctionnalité repasse", "fonctionnalités repassent")} À planifier.`,
    failed: "Impossible d'enregistrer le sprint.",
    codeTaken: "Ce code est déjà pris par un autre sprint.",
  },
};
