import type { PrCounts } from "./pr-stacks";

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`;

const counter = (c: PrCounts): string =>
  [
    plural(c.open, "PR ouverte", "PR ouvertes"),
    plural(c.stacks, "pile", "piles"),
    ...(c.waiting > 0 ? [`${c.waiting} en attente de review`] : []),
    ...(c.changes > 0 ? [`${c.changes} à corriger`] : []),
  ].join(" · ");

export const frPrs = {
  canvas: "PR ouvertes",
  stack: (n: number) => (n > 1 ? `${n} PR empilées` : "1 PR"),
  range: (min: number, max: number) => (min === max ? `#${min}` : `#${min} à #${max}`),
  feature: (shortKey: string, title: string) => `${shortKey} · ${title}`,
  noFeature: "Hors fonctionnalité",
  on: (base: string) => `sur ${base}`,
  rail: "branche de base",
  review: {
    draft: "Brouillon",
    waiting: "En attente de review",
    changes: "Changements demandés",
    approved: "Approuvée",
  },
  ci: { ok: "CI verte", error: "CI rouge", running: "CI en cours" },
  late: "en retard",
  session: "session",
  counter,
  legend: {
    link: "Basée sur la PR du dessous",
    session: "Session active",
    click: "Clic : fiche du ticket",
  },
  empty: {
    title: "Aucune PR ouverte",
    hint: "Les PR ouvertes des étapes apparaissent ici, empilées sur leur branche de base.",
  },
  open: (number: number, title: string, key: string) => `PR #${number} · ${title} · ${key}`,
  help: "Flèches : PR du dessus, du dessous, pile voisine · Entrée : ouvrir",
};
