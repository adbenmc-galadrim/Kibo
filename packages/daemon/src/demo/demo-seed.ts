import {
  addDays,
  type IsoDate,
  isoWeekday,
  nextMonday,
  type ProjectSetup,
  type PrState,
  type StatusId,
} from "@kibo/schema";

export type DemoPr = { number: number; state: PrState };
export type DemoStep = {
  key: string;
  title: string;
  status: StatusId;
  description: string;
  branch?: string;
  pr?: DemoPr;
};
export type DemoFeature = { title: string; description: string; sprint: number; steps: readonly DemoStep[] };
export type DemoLink = { from: string; to: string };

export const DEMO_CLIENT = "Boulangerie Martin";
export const DEMO_REPO = "https://github.com/kibo-demo/boutique";
export const DEMO_SPRINT_COUNT = 3;

export const DEMO_FEATURES: readonly DemoFeature[] = [
  {
    title: "Catalogue des produits",
    description: "Les clients parcourent les pains et les viennoiseries du jour.",
    sprint: 0,
    steps: [
      {
        key: "DEMO-1",
        title: "Liste des produits",
        status: "done",
        description: "Afficher les produits avec leur photo et leur prix.",
        branch: "demo/liste-produits",
        pr: { number: 1, state: "merged" },
      },
      {
        key: "DEMO-2",
        title: "Fiche produit",
        status: "done",
        description: "Une page par produit, avec les allergènes.",
        branch: "demo/fiche-produit",
        pr: { number: 2, state: "merged" },
      },
    ],
  },
  {
    title: "Panier et commande",
    description: "Commander en ligne et retirer en boutique.",
    sprint: 1,
    steps: [
      {
        key: "DEMO-3",
        title: "Panier",
        status: "in_review",
        description: "Ajouter, retirer et compter les produits du panier.",
        branch: "demo/panier",
        pr: { number: 3, state: "open" },
      },
      {
        key: "DEMO-4",
        title: "Paiement en ligne",
        status: "in_progress",
        description: "Payer la commande par carte avant le retrait.",
        branch: "demo/paiement",
      },
      {
        key: "DEMO-5",
        title: "Confirmation par e-mail",
        status: "todo",
        description: "Envoyer le récapitulatif et l'heure de retrait.",
      },
      {
        key: "DEMO-8",
        title: "Démo au client",
        status: "todo",
        description: "Montrer la commande en ligne à la boulangerie, du panier au retrait.",
      },
    ],
  },
  {
    title: "Espace client",
    description: "Retrouver ses commandes et ses informations.",
    sprint: 2,
    steps: [
      {
        key: "DEMO-6",
        title: "Connexion",
        status: "todo",
        description: "Se connecter pour retrouver ses commandes.",
      },
      {
        key: "DEMO-7",
        title: "Historique des commandes",
        status: "todo",
        description: "La liste des commandes passées, la plus récente en tête.",
      },
    ],
  },
];

export const DEMO_LINKS: readonly DemoLink[] = [{ from: "DEMO-6", to: "DEMO-7" }];

export const DEMO_QUESTION = {
  on: "DEMO-6",
  title: "Connexion par e-mail seulement, ou aussi par un compte Google ?",
  context: "Le client doit trancher avant que la connexion soit développée.",
  blocking: true,
  recipient: "client",
} as const;

export const DEMO_ROLES = { review: "DEMO-4", copy: "DEMO-5" } as const;

export const DEMO_REVIEW_PR = { number: 4, base: "main", head: "demo/paiement" } as const;

export const demoPrUrl = (n: number): string => `${DEMO_REPO}/pull/${n}`;

const LAST_WORKDAY = 5;

function currentWeekMonday(today: IsoDate): IsoDate {
  const weekday = isoWeekday(today);
  return weekday > LAST_WORKDAY ? nextMonday(today) : addDays(today, 1 - weekday);
}

export function demoSetup(today: IsoDate): ProjectSetup {
  return {
    sprintStart: addDays(currentWeekMonday(today), -7),
    sprintCount: DEMO_SPRINT_COUNT,
    sprintWeeks: 1,
  };
}
