export const frNewTicket = {
  feature: "Fonctionnalité",
  none: "Aucune",
  newFeature: "Nouvelle fonctionnalité",
  created: (key: string | null) => (key === null ? "Ticket créé" : `${key} créé`),
  open: "Ouvrir",
};
