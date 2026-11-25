export const SPEC_SCREENS = [
  "graph",
  "kanban",
  "planning",
  "dashboard",
  "ticket",
  "questions",
  "agent",
] as const;
type SpecScreen = (typeof SPEC_SCREENS)[number];
type Screen = SpecScreen | "all";

type Kept = { screen: Screen; feature: string; phone: "same" | "adapted"; how: string };
type Excluded = {
  screen: Screen;
  feature: string;
  phone: "excluded";
  reason: string;
  names: readonly string[];
};
type InventoryEntry = Kept | Excluded;

const PAGES_AND_LAYOUT = [
  "addPage",
  "renamePage",
  "movePage",
  "deletePage",
  "setPageLayout",
  "addInstance",
  "removeInstance",
  "setInstanceComponent",
  "setInstanceLayout",
  "addBinding",
  "removeBinding",
];

export const INVENTORY: readonly InventoryEntry[] = [
  {
    screen: "graph",
    feature:
      "vue Fonctionnalités (cadres, segments, étapes, attente en couleur, démarrable en vert), vue PRs (piles, CI), filtre par sprint, « Tout voir » et cadre replié, légende, « Lancer dans T3 » sur une étape, ouverture d'une fiche, ouverture d'une fonctionnalité",
    phone: "adapted",
    how: "colonnes de sprint, appui long pour le menu, légende et filtre en feuille",
  },
  {
    screen: "graph",
    feature: "flèches de dépendance",
    phone: "excluded",
    reason: "déjà retirées du bureau (§47, 2026-10-23) ; les dépendances se lisent dans la fiche",
    names: [],
  },
  {
    screen: "kanban",
    feature:
      "colonnes par statut, colonnes vides repliées, déplacement d'une carte (glisser et « Déplacer vers »), filtres (mes tickets, démarrable, sprint courant, label, « À reprendre »), « Lancer dans T3 », bloquer avec motif, retirer, pastille T3",
    phone: "same",
    how: "requêtes de conteneur ; appui long ⇒ feuille d'actions au lieu de l'infobulle et du menu contextuel",
  },
  {
    screen: "planning",
    feature:
      "colonnes de sprint et backlog, glisser une fonctionnalité, créer une fonctionnalité, créer, modifier et supprimer un sprint, bande « En attente », alertes de sprint, limite d'ouverture, fiche de sprint",
    phone: "same",
    how: "requêtes de conteneur, ouverture sur le sprint courant, bande « En attente » repliée à la première visite",
  },
  {
    screen: "dashboard",
    feature:
      "indicateurs, sprint courant, « En ce moment », prochaine fonctionnalité, activité, en revue, questions, échéances, en retard, en attente, « Livrée aujourd'hui », récapitulatif de sprint, « Pour commencer »",
    phone: "same",
    how: "colonnes empilées sous @max-2xl",
  },
  {
    screen: "dashboard",
    feature: "« Modifier le projet », page « Aujourd'hui » (tous les projets)",
    phone: "excluded",
    reason:
      "« Modifier le projet » renvoie aux réglages du projet (Paramètres) ; « Aujourd'hui » rassemble tous les projets du Mac, le téléphone en ouvre un à la fois",
    names: [],
  },
  {
    screen: "ticket",
    feature:
      "titre, clé (copie), statut, sprint, assigné, domaine, facultatif, description, labels, liens, mise en attente et reprise, questions du ticket, activité, PR et CI, fil T3, « Lancer dans T3 », supprimer, sous-tickets",
    phone: "same",
    how: "plein écran ; « Lancer dans T3 » dans la barre du ticket ; champs en lecture seule Mac éteint",
  },
  {
    screen: "ticket",
    feature: "« Ouvrir dans T3 », « Ouvrir le fichier », journal CI complet Mac éteint, maquettes liées",
    phone: "excluded",
    reason:
      "lien et fichier locaux au Mac, journal volumineux relayé Mac allumé seulement, comptes Figma et Penpot du Mac",
    names: ["getDesignFrame", "linkDesignFrame"],
  },
  {
    screen: "questions",
    feature:
      "liste compacte, détail déplié, répondre (texte, options, validation, correction), coller la réponse, images (voir, zoom), créer, modifier, supprimer, destinataires, marquer envoyée, historique, filtres",
    phone: "same",
    how: "lignes en cartes et cibles de 44 px sous @max-xl",
  },
  {
    screen: "questions",
    feature: "export des questions",
    phone: "adapted",
    how: "copie dans le presse-papiers seulement : pas de système de fichiers",
  },
  {
    screen: "agent",
    feature:
      "conversation, envoyer un message, lot proposé (valider, choisir, refuser avec un commentaire), sessions passées, compteur dans l'en-tête, réveil",
    phone: "same",
    how: "plein écran, saisie grisée Mac éteint",
  },
  {
    screen: "agent",
    feature: "« Nouvel agent », chemin de la mémoire",
    phone: "excluded",
    reason: "réservé au Mac (spec §52) ; chemin local",
    names: ["resetProjectAgent"],
  },
  {
    screen: "all",
    feature: "changer de projet (activés), sombre et clair du système",
    phone: "adapted",
    how: "sélecteur dans l'en-tête",
  },
  {
    screen: "all",
    feature:
      "Paramètres, Agents et skills, Fichiers, Maquettes, intégrations, pages et disposition, création de projet",
    phone: "excluded",
    reason: "hors périmètre du téléphone (spec §52)",
    names: [...PAGES_AND_LAYOUT, "importExternalTicket"],
  },
];

export const EXCLUDED_NAMES: ReadonlySet<string> = new Set(
  INVENTORY.flatMap((entry) => (entry.phone === "excluded" ? entry.names : [])),
);
